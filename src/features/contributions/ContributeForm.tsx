import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { currentOpeningHours } from '../../domain/catalog';
import { parseDayRanges } from '../../domain/opening-hours/parse';
import { validateWeeklyIntervals } from '../../domain/opening-hours/schedule';
import { addDays, getZonedParts } from '../../domain/time';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

const DAYS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

const KINDS = [
  { id: 'status', label: 'Stato ora' },
  { id: 'weekly', label: 'Orari' },
  { id: 'closure', label: 'Chiusura' },
  { id: 'opening', label: 'Apertura' },
  { id: 'report', label: 'Dati errati' },
] as const;

type Kind = (typeof KINDS)[number]['id'];

function tomorrowKey(): string {
  return addDays(getZonedParts(new Date(), 'Europe/Rome').dateKey, 1);
}

export function ContributeForm({ businessId }: { businessId: string }) {
  const { catalog, profile, submitAs } = useStore();
  const business = catalog.businesses.find((item) => item.id === businessId);
  const [kind, setKind] = useState<Kind>('status');
  const [name, setName] = useState(profile?.displayName ?? '');
  const [days, setDays] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    const rows = business ? currentOpeningHours(catalog, business.id) : [];
    for (let day = 1; day <= 7; day += 1) {
      initial[day] = rows
        .filter((row) => row.dayOfWeek === day)
        .map((row) => `${row.opensAt}-${row.closesAt}`)
        .join(', ');
    }
    return initial;
  });
  const [date, setDate] = useState(tomorrowKey);
  const [opensAt, setOpensAt] = useState('10:00');
  const [closesAt, setClosesAt] = useState('18:00');
  const [reason, setReason] = useState('');
  const [reportKind, setReportKind] = useState<'closed_permanently' | 'wrong_details'>('wrong_details');
  const [note, setNote] = useState('');
  const [correctedName, setCorrectedName] = useState(business?.name ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const published = useMemo(() => {
    if (!business?.scheduleKnown) return 'Orari settimanali non disponibili.';
    return currentOpeningHours(catalog, business.id)
      .map((row) => `${DAYS[row.dayOfWeek]} ${row.opensAt}–${row.closesAt}`)
      .join(' · ');
  }, [business, catalog]);

  if (!business) return <Text style={styles.error}>Attività non trovata.</Text>;

  function onSubmit() {
    setError(null);
    setMessage(null);
    if (!business) return;
    if (kind === 'status') return;
    if (kind === 'weekly') {
      const intervals = [];
      for (let day = 1; day <= 7; day += 1) {
        const parsed = parseDayRanges(days[day] ?? '');
        if (!parsed.ok) {
          setError(`${DAYS[day]}: ${parsed.message}`);
          return;
        }
        intervals.push(...parsed.ranges.map((range) => ({ dayOfWeek: day, ...range })));
      }
      if (intervals.length === 0) {
        setError('Indica almeno una fascia. Un giorno vuoto resta chiuso.');
        return;
      }
      const validation = validateWeeklyIntervals(intervals);
      if (validation) {
        setError(validation);
        return;
      }
      const result = submitAs(name, { businessId, type: 'weekly_hours', payload: { intervals } });
      if (!result.ok) setError(result.message);
      else setMessage(result.message);
      return;
    }
    if (kind === 'closure') {
      const result = submitAs(name, {
        businessId,
        type: 'temporary_closure',
        payload: { date: date.trim(), reason },
      });
      if (!result.ok) setError(result.message);
      else setMessage(result.message);
      return;
    }
    if (kind === 'opening') {
      const result = submitAs(name, {
        businessId,
        type: 'extraordinary_opening',
        payload: { date: date.trim(), opensAt: opensAt.trim(), closesAt: closesAt.trim(), reason },
      });
      if (!result.ok) setError(result.message);
      else setMessage(result.message);
      return;
    }
    const result = submitAs(name, {
      businessId,
      type: 'report_incorrect',
      payload:
        reportKind === 'closed_permanently'
          ? { kind: 'closed_permanently', note }
          : { kind: 'wrong_details', note, name: correctedName, address: business.address },
    });
    if (!result.ok) setError(result.message);
    else setMessage(result.message);
  }

  function confirm(observed: 'open' | 'closed') {
    setError(null);
    setMessage(null);
    if (!business) return;
    const result = submitAs(name, {
      businessId,
      type: 'status_confirmation',
      payload: { observed },
    });
    if (!result.ok) setError(result.message);
    else setMessage(result.message);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.help}>
        La consultazione non richiede un account. Per contribuire basta un nome, salvato solo su questo dispositivo.
      </Text>
      <Text style={styles.label}>Il tuo nome</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Come ti vedono gli altri"
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel="Nome visualizzato"
      />
      <View style={styles.kinds}>
        {KINDS.map((item) => {
          const selected = kind === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                setKind(item.id);
                setError(null);
                setMessage(null);
              }}
              style={[styles.kind, selected && styles.kindOn]}
            >
              <Text style={[styles.kindText, selected && styles.kindTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {kind === 'status' ? (
        <View style={styles.block}>
          <Text style={styles.help}>
            Confermi solo quello che vedi adesso. La conferma non riscrive gli orari settimanali.
          </Text>
          <Button label="È aperto adesso" onPress={() => confirm('open')} />
          <Button label="È chiuso adesso" onPress={() => confirm('closed')} variant="secondary" />
        </View>
      ) : null}

      {kind === 'weekly' ? (
        <View style={styles.block}>
          <Text style={styles.help}>Una fascia per riga, per esempio 09:00-13:00, 15:00-19:00. Giorno vuoto = chiuso.</Text>
          {DAYS.slice(1).map((label, index) => (
            <View key={label}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                value={days[index + 1]}
                onChangeText={(value) => setDays((current) => ({ ...current, [index + 1]: value }))}
                placeholder="Chiuso"
                placeholderTextColor={colors.muted}
                style={styles.input}
                accessibilityLabel={`Orari del ${label}`}
                autoCapitalize="none"
              />
            </View>
          ))}
          <Button label="Invia proposta orari" onPress={onSubmit} />
        </View>
      ) : null}

      {kind === 'closure' || kind === 'opening' ? (
        <View style={styles.block}>
          <Text style={styles.label}>Data (AAAA-MM-GG)</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
            style={styles.input}
            accessibilityLabel="Data dell'eccezione"
          />
          {kind === 'opening' ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>Apre</Text>
                <TextInput value={opensAt} onChangeText={setOpensAt} style={styles.input} accessibilityLabel="Orario di apertura" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Chiude</Text>
                <TextInput value={closesAt} onChangeText={setClosesAt} style={styles.input} accessibilityLabel="Orario di chiusura" />
              </View>
            </View>
          ) : null}
          <Text style={styles.label}>Motivo, se vuoi</Text>
          <TextInput value={reason} onChangeText={setReason} style={styles.input} accessibilityLabel="Motivo" />
          <Button label={kind === 'closure' ? 'Invia chiusura temporanea' : 'Invia apertura straordinaria'} onPress={onSubmit} />
        </View>
      ) : null}

      {kind === 'report' ? (
        <View style={styles.block}>
          <View style={styles.kinds}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: reportKind === 'wrong_details' }}
              onPress={() => setReportKind('wrong_details')}
              style={[styles.kind, reportKind === 'wrong_details' && styles.kindOn]}
            >
              <Text style={[styles.kindText, reportKind === 'wrong_details' && styles.kindTextOn]}>Dati errati</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: reportKind === 'closed_permanently' }}
              onPress={() => setReportKind('closed_permanently')}
              style={[styles.kind, reportKind === 'closed_permanently' && styles.kindOn]}
            >
              <Text style={[styles.kindText, reportKind === 'closed_permanently' && styles.kindTextOn]}>
                Non esiste più
              </Text>
            </Pressable>
          </View>
          {reportKind === 'wrong_details' ? (
            <>
              <Text style={styles.label}>Nome corretto</Text>
              <TextInput value={correctedName} onChangeText={setCorrectedName} style={styles.input} accessibilityLabel="Nome corretto" />
            </>
          ) : null}
          <Text style={styles.label}>Nota</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={[styles.input, styles.multiline]}
            multiline
            accessibilityLabel="Nota sulla segnalazione"
          />
          <Button label="Invia segnalazione" onPress={onSubmit} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? (
        <View style={styles.success}>
          <Text style={styles.successTitle}>{message}</Text>
          <Text style={styles.help}>Orari pubblicati adesso: {published || 'nessuna fascia settimanale.'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  help: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  kind: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  kindOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { color: colors.ink, fontWeight: '700' },
  kindTextOn: { color: colors.onPrimary },
  block: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 21 },
  success: {
    backgroundColor: colors.openBg,
    borderRadius: 12,
    padding: space.md,
    gap: space.sm,
  },
  successTitle: { color: colors.openInk, fontSize: 16, fontWeight: '700', lineHeight: 22 },
});
