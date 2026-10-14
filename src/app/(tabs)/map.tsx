import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBadge, statusTone } from '../../components/StatusBadge';
import { searchBusinesses, type SearchHit } from '../../domain/search/search';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

export default function MapScreen() {
  const router = useRouter();
  const { catalog, filters } = useStore();
  const [now] = useState(() => new Date());
  const result = useMemo(
    () =>
      searchBusinesses(catalog, {
        text: filters.text,
        category: filters.category ?? undefined,
        latitude: filters.mode === 'point' ? filters.center?.latitude : undefined,
        longitude: filters.mode === 'point' ? filters.center?.longitude : undefined,
        radiusMeters: filters.mode === 'point' ? filters.radiusMeters : undefined,
        openNow: filters.openNow,
        now,
        limit: 50,
      }),
    [catalog, filters, now],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text accessibilityRole="header" style={styles.title}>
          Mappa
        </Text>
        <Text style={styles.subtitle}>
          Posizione relativa degli esercizi trovati. Lo stato è scritto su ogni punto, non solo colorato.
        </Text>
        {result.items.length === 0 ? (
          <Text style={styles.empty}>Nessun esercizio da mostrare con i filtri attuali.</Text>
        ) : (
          <Plot hits={result.items} onOpen={(id) => router.push(`/business/${id}`)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Plot({ hits, onOpen }: { hits: SearchHit[]; onOpen: (id: string) => void }) {
  const bounds = hits.reduce(
    (acc, hit) => ({
      minLat: Math.min(acc.minLat, hit.business.latitude),
      maxLat: Math.max(acc.maxLat, hit.business.latitude),
      minLng: Math.min(acc.minLng, hit.business.longitude),
      maxLng: Math.max(acc.maxLng, hit.business.longitude),
    }),
    { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
  );
  const latSpan = Math.max(0.004, bounds.maxLat - bounds.minLat);
  const lngSpan = Math.max(0.004, bounds.maxLng - bounds.minLng);
  return (
    <View style={styles.plot}>
      {hits.map((hit) => {
        const left = ((hit.business.longitude - bounds.minLng) / lngSpan) * 100;
        const top = ((bounds.maxLat - hit.business.latitude) / latSpan) * 100;
        return (
          <Pressable
            key={hit.business.id}
            accessibilityRole="button"
            accessibilityLabel={`${hit.business.name}. ${hit.statusLabel}`}
            onPress={() => onOpen(hit.business.id)}
            style={[styles.marker, { left: `${Math.min(82, Math.max(2, left))}%`, top: `${Math.min(78, Math.max(2, top))}%` }]}
          >
            <Text style={styles.markerName} numberOfLines={1}>
              {hit.business.name}
            </Text>
            <StatusBadge label={shortStatus(hit)} tone={statusTone(hit.open.status)} />
          </Pressable>
        );
      })}
    </View>
  );
}

function shortStatus(hit: SearchHit): string {
  if (hit.open.status === 'open') return 'Aperto';
  if (hit.open.status === 'closed') return 'Chiuso';
  return 'Orari n.d.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  empty: { color: colors.muted, fontSize: 16 },
  plot: {
    height: 460,
    borderRadius: 16,
    backgroundColor: '#E7F0EA',
    borderWidth: 1,
    borderColor: colors.line,
    position: 'relative',
  },
  marker: { position: 'absolute', maxWidth: 150, gap: 4 },
  markerName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
});
