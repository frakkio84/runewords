import { StyleSheet, Text, View } from 'react-native';
import type { OpeningHoursInterval } from '../../domain/catalog';
import { describeIntervals } from '../../domain/opening-hours/schedule';
import { colors, space } from '../../theme';

const DAYS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export function HoursList({
  known,
  intervals,
}: {
  known: boolean;
  intervals: OpeningHoursInterval[];
}) {
  if (!known) {
    return <Text style={styles.unknown}>Orari settimanali non disponibili.</Text>;
  }
  return (
    <View>
      {DAYS.slice(1).map((label, index) => {
        const day = index + 1;
        const rows = intervals.filter((interval) => interval.dayOfWeek === day);
        return (
          <View key={label} style={styles.row}>
            <Text style={styles.day}>{label}</Text>
            <Text style={styles.hours}>{describeIntervals(rows)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  unknown: { color: colors.unknownInk, fontSize: 16, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  day: { color: colors.ink, fontSize: 16, width: 120 },
  hours: { color: colors.ink, fontSize: 16, flex: 1, textAlign: 'right' },
});
