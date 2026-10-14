import { StyleSheet, Text, View } from 'react-native';
import { TRUST_LABELS, type TrustLabel } from '../domain/trust/trust';
import { colors, space } from '../theme';

export function TrustBadge({ trust }: { trust: TrustLabel }) {
  const label = TRUST_LABELS[trust];
  return (
    <View accessibilityLabel={`Attendibilità: ${label}`}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: colors.chip,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
});
