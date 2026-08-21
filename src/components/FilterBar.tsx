import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LadderFilter, RunewordFilters } from '../types';
import { ITEM_TYPE_FILTERS } from '../lib/itemTypes';
import { toggleSocket } from '../lib/filter';
import { colors, fonts } from '../theme';
import { Chip } from './Chip';

const SOCKET_OPTIONS = [2, 3, 4, 5, 6];

const LADDER_OPTIONS: ReadonlyArray<{ value: LadderFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'nonLadder', label: 'Non-Ladder' },
];

type FilterBarProps = {
  filters: RunewordFilters;
  onChange: (next: RunewordFilters) => void;
  resultCount: number;
  totalCount: number;
};

export function FilterBar({
  filters,
  onChange,
  resultCount,
  totalCount,
}: FilterBarProps) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={filters.query}
        onChangeText={(query) => onChange({ ...filters, query })}
        placeholder="Search name, runes, or stats"
        placeholderTextColor={colors.faint}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <Text style={styles.section}>Runes needed</Text>
      <View style={styles.row}>
        {SOCKET_OPTIONS.map((socketCount) => (
          <Chip
            key={socketCount}
            label={`${socketCount}`}
            active={filters.sockets.includes(socketCount)}
            onPress={() =>
              onChange({
                ...filters,
                sockets: toggleSocket(filters.sockets, socketCount),
              })
            }
          />
        ))}
      </View>

      <Text style={styles.section}>Ladder</Text>
      <View style={styles.row}>
        {LADDER_OPTIONS.map(({ value, label }) => (
          <Chip
            key={value}
            label={label}
            active={filters.ladder === value}
            onPress={() => onChange({ ...filters, ladder: value })}
          />
        ))}
      </View>

      <Text style={styles.section}>Weapon / item class</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        <Chip
          label="All classes"
          active={filters.itemType === null}
          onPress={() => onChange({ ...filters, itemType: null })}
        />
        {ITEM_TYPE_FILTERS.map((itemType) => (
          <Chip
            key={itemType}
            label={itemType}
            active={filters.itemType === itemType}
            onPress={() =>
              onChange({
                ...filters,
                itemType: filters.itemType === itemType ? null : itemType,
              })
            }
          />
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {resultCount} of {totalCount} runewords
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  search: {
    backgroundColor: colors.search,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  section: {
    color: colors.goldDim,
    fontFamily: fonts.title,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  typeRow: {
    paddingRight: 16,
    alignItems: 'center',
  },
  count: {
    color: colors.faint,
    fontSize: 13,
    marginTop: 4,
  },
});
