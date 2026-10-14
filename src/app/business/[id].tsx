import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { StatusBadge, statusTone } from '../../components/StatusBadge';
import { TrustBadge } from '../../components/TrustBadge';
import { categoryLabel } from '../../domain/categories';
import { scheduleFor, type Contribution } from '../../domain/catalog';
import { describeStatus, isOpenAt } from '../../domain/opening-hours/schedule';
import { getZonedParts } from '../../domain/time';
import { PROVENANCE_LABELS, trustLabel } from '../../domain/trust/trust';
import { HoursList } from '../../features/opening-hours/HoursList';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

export default function BusinessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { catalog } = useStore();
  const business = catalog.businesses.find((item) => item.id === id);

  if (!business) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.title}>Scheda non trovata</Text>
          <Button label="Torna alla ricerca" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  const now = new Date();
  const schedule = scheduleFor(catalog, business);
  const open = isOpenAt(schedule, now);
  const todayKey = getZonedParts(now, schedule.timeZone).dateKey;
  const statusText =
    business.status === 'closed_permanently' ? 'Chiuso definitivamente' : describeStatus(open, todayKey);
  const tone = business.status === 'closed_permanently' ? 'closed' : open.status;
  const trust = trustLabel(catalog, business.id, now);
  const source = catalog.sources.find((item) => item.businessId === business.id);
  const latestConfirmation = catalog.contributions
    .filter(
      (item): item is Extract<Contribution, { type: 'status_confirmation' }> =>
        item.businessId === business.id && item.type === 'status_confirmation',
    )
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const specials = catalog.specialHours
    .filter((item) => item.businessId === business.id)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || b.createdAt.localeCompare(a.createdAt));
  const seenDates = new Set<string>();
  const visibleSpecials = specials.filter((item) => {
    if (seenDates.has(item.date)) return false;
    seenDates.add(item.date);
    return item.date >= todayKey;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Button label="Indietro" variant="quiet" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text style={styles.kicker}>{categoryLabel(business.category)}</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {business.name}
        </Text>
        <Text style={styles.body}>{business.address || 'Indirizzo non disponibile'}</Text>
        <Text style={styles.meta}>
          Posizione {business.latitude.toFixed(5)}, {business.longitude.toFixed(5)}
        </Text>
        <StatusBadge label={statusText} tone={tone} />
        <TrustBadge trust={trust} />
        <Text style={styles.disclaimer}>
          Queste etichette descrivono provenienza e conferme. Non sono una garanzia di correttezza.
        </Text>
        {trust === 'needs_reconfirmation' ? (
          <Text style={styles.note}>
            Ci sono contributi recenti in conflitto con il dato pubblicato. Gli orari visibili restano quelli già
            pubblicati.
          </Text>
        ) : null}

        <Text style={styles.section}>Orari settimanali</Text>
        <HoursList
          known={business.scheduleKnown}
          intervals={catalog.openingHours.filter(
            (row) => row.businessId === business.id && row.version === business.hoursVersion,
          )}
        />
        <Text style={styles.meta}>
          Provenienza: {business.hoursSource ? PROVENANCE_LABELS[business.hoursSource] : 'Non indicata'}
          {source?.attribution ? ` · ${source.attribution}` : ''}
        </Text>
        <Text style={styles.meta}>
          {latestConfirmation
            ? `Ultima conferma: ${latestConfirmation.payload.observed === 'open' ? 'aperto' : 'chiuso'}, ${new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(latestConfirmation.createdAt))}`
            : 'Nessuna conferma dello stato attuale.'}
        </Text>

        <Text style={styles.section}>Eccezioni</Text>
        {visibleSpecials.length === 0 ? (
          <Text style={styles.body}>Nessuna eccezione in programma.</Text>
        ) : (
          visibleSpecials.map((special) => (
            <Text key={special.id} style={styles.body}>
              {special.date}:{' '}
              {special.isClosed ? 'chiuso' : `${special.opensAt}–${special.closesAt}`}
              {special.reason ? ` · ${special.reason}` : ''}
            </Text>
          ))
        )}

        <Button label="Conferma o correggi" onPress={() => router.push(`/contribute/${business.id}`)} />
        <Button label="Rivendica scheda" variant="secondary" onPress={() => router.push(`/claims/${business.id}`)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 48 },
  kicker: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  section: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: space.sm },
  body: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  disclaimer: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  note: { color: colors.unknownInk, fontSize: 15, lineHeight: 21 },
});
