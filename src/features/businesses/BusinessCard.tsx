import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge, statusTone } from '../../components/StatusBadge';
import { TrustBadge } from '../../components/TrustBadge';
import { categoryLabel } from '../../domain/categories';
import type { SearchHit } from '../../domain/search/search';
import { colors, space } from '../../theme';

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function BusinessCard({ hit, onPress }: { hit: SearchHit; onPress: () => void }) {
  const meta = [categoryLabel(hit.business.category), hit.distanceMeters === null ? null : formatDistance(hit.distanceMeters)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hit.business.name}. ${hit.statusLabel}. ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.name}>{hit.business.name}</Text>
      <Text style={styles.meta}>{meta}</Text>
      <Text style={styles.address}>{hit.business.address || 'Indirizzo non disponibile'}</Text>
      <View style={styles.badges}>
        <StatusBadge label={hit.statusLabel} tone={statusTone(hit.open.status)} />
        <TrustBadge trust={hit.trust} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
  name: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14 },
  address: { color: colors.ink, fontSize: 15 },
  badges: { gap: space.sm, marginTop: space.xs },
});
