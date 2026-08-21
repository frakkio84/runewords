import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import runewordData from './src/data/runewords.json';
import { FilterBar } from './src/components/FilterBar';
import { RunewordCard } from './src/components/RunewordCard';
import { RunewordDetail } from './src/components/RunewordDetail';
import { EMPTY_FILTERS, filterRunewords } from './src/lib/filter';
import type { Runeword, RunewordFilters } from './src/types';
import { colors, fonts } from './src/theme';

const runewords = runewordData as Runeword[];

export default function App() {
  const [filters, setFilters] = useState<RunewordFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Runeword | null>(null);

  const visible = useMemo(
    () => filterRunewords(runewords, filters),
    [filters],
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.kicker}>Diablo 2 Resurrected</Text>
          <Text style={styles.title}>Runewords</Text>
          <Text style={styles.subtitle}>
            All {runewords.length} recipes from diablo2.io, including RotW
          </Text>
        </View>

        <FilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={visible.length}
          totalCount={runewords.length}
        />

        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RunewordCard runeword={item} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No runewords match these filters.</Text>
          }
        />

        <Modal
          visible={selected !== null}
          animationType="slide"
          onRequestClose={() => setSelected(null)}
        >
          <SafeAreaProvider>
            <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
              <View style={styles.modalBar}>
                <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                  <Text style={styles.close}>Close</Text>
                </Pressable>
              </View>
              {selected ? <RunewordDetail runeword={selected} /> : null}
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  kicker: {
    color: colors.goldDim,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 34,
    marginTop: 4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 24,
  },
  modalBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.bgRaised,
  },
  close: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: '700',
  },
});
