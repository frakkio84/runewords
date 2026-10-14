import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { contributionStatusLabel, CONTRIBUTION_TYPE_LABELS } from '../../features/contributions/labels';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

export default function ProfileScreen() {
  const { catalog, profile, ensureUser, renameUser, withdraw, resync, importReport, syncing } = useStore();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const mine = catalog.contributions
    .filter((contribution) => contribution.userId === profile?.id)
    .slice()
    .reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>
          Profilo
        </Text>
        <Text style={styles.body}>
          Per consultare non serve un account. Il nome serve solo a firmare i contributi e resta su questo dispositivo,
          in attesa dell’accesso con Supabase Auth.
        </Text>
        <Text style={styles.label}>Nome visualizzato</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          accessibilityLabel="Nome visualizzato"
        />
        <Button
          label={profile ? 'Aggiorna nome' : 'Salva nome'}
          onPress={() => {
            const result = profile ? renameUser(name) : ensureUser(name);
            setMessage(result.ok ? 'Nome salvato.' : result.message);
          }}
        />
        {message ? <Text style={styles.note}>{message}</Text> : null}

        <Text style={styles.section}>I miei contributi</Text>
        {mine.length === 0 ? (
          <Text style={styles.body}>Non hai ancora inviato conferme o proposte.</Text>
        ) : (
          mine.map((contribution) => {
            const business = catalog.businesses.find((item) => item.id === contribution.businessId);
            return (
              <View key={contribution.id} style={styles.card}>
                <Text style={styles.cardTitle}>{business?.name ?? 'Attività'}</Text>
                <Text style={styles.body}>
                  {CONTRIBUTION_TYPE_LABELS[contribution.type]} · {contributionStatusLabel(contribution)}
                </Text>
                <Text style={styles.meta}>
                  {new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(contribution.createdAt),
                  )}
                </Text>
                {contribution.status === 'pending' ? (
                  <Button
                    label="Ritira proposta"
                    variant="secondary"
                    onPress={() => {
                      const result = withdraw(contribution.id);
                      setMessage(result.message);
                    }}
                  />
                ) : null}
              </View>
            );
          })
        )}

        <Text style={styles.section}>Catalogo</Text>
        <Text style={styles.body}>
          L’aggiornamento ripete l’importazione del catalogo pilota. Non crea duplicati e non sovrascrive gli orari
          protetti da titolare, community o moderatore.
        </Text>
        <Button
          label={syncing ? 'Aggiornamento…' : 'Aggiorna catalogo'}
          variant="secondary"
          disabled={syncing}
          onPress={() => {
            void resync().then((result) => {
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              const skipped = result.report.skippedProtectedHours.length;
              setMessage(
                `Importazione completata. Nuovi: ${result.report.created}. Aggiornati: ${result.report.refreshed}. Uniti: ${result.report.merged}. Orari protetti conservati: ${skipped}. Errori: ${result.report.errors.length}.`,
              );
            });
          }}
        />
        {importReport ? <Text style={styles.meta}>Ultimo esito disponibile qui sopra.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 40 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: space.md },
  body: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  note: { color: colors.primary, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.sm,
  },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14 },
});
