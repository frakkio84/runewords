import { StyleSheet, Text, View } from 'react-native';
import type { OpenStatus } from '../domain/opening-hours/schedule';
import { colors, space } from '../theme';

export function statusTone(status: OpenStatus['status']): 'open' | 'closed' | 'unknown' {
  return status;
}

export function StatusBadge({ label, tone }: { label: string; tone: 'open' | 'closed' | 'unknown' }) {
  return (
    <View accessibilityLabel={label} style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  text: { fontSize: 14, fontWeight: '700' },
  open: { backgroundColor: colors.openBg },
  closed: { backgroundColor: colors.closedBg },
  unknown: { backgroundColor: colors.unknownBg },
  openText: { color: colors.openInk },
  closedText: { color: colors.closedInk },
  unknownText: { color: colors.unknownInk },
});
