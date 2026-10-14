import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BusinessCard } from '../../features/businesses/BusinessCard';
import { CATEGORIES } from '../../domain/categories';
import { searchBusinesses } from '../../domain/search/search';
import { readCurrentCoordinates } from '../../services/location/location';
import { CITY_CENTER } from '../../data/pilotPlaces';
import { useStore } from '../../state/Store';
import { colors, space } from '../../theme';

const RADII = [500, 1000, 2000, 5000];

export default function SearchScreen() {
  const router = useRouter();
  const { catalog, filters, setFilters } = useStore();
  const [now] = useState(() => new Date());
  const [limit, setLimit] = useState(20);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

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
        limit,
        offset: 0,
      }),
    [catalog, filters, limit, now],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={result.items}
        keyExtractor={(item) => item.business.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>Bologna</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Orari
            </Text>
            <Text style={styles.subtitle}>
              Esercizi e orari di apertura. Puoi consultare senza registrarti.
            </Text>
            <TextInput
              value={filters.text}
              onChangeText={(text) => {
                setLimit(20);
                setFilters({ text });
              }}
              placeholder="Nome dell’esercizio"
              placeholderTextColor={colors.muted}
              style={styles.search}
              accessibilityLabel="Cerca per nome"
              autoCorrect={false}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip
                label="Tutte"
                selected={filters.category === null}
                onPress={() => setFilters({ category: null })}
              />
              {CATEGORIES.map((category) => (
                <Chip
                  key={category.id}
                  label={category.label}
                  selected={filters.category === category.id}
                  onPress={() =>
                    setFilters({ category: filters.category === category.id ? null : category.id })
                  }
                />
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filters.openNow }}
              onPress={() => setFilters({ openNow: !filters.openNow })}
              style={[styles.toggle, filters.openNow && styles.toggleOn]}
            >
              <Text style={[styles.toggleText, filters.openNow && styles.toggleTextOn]}>
                {filters.openNow ? 'Filtro attivo: aperto adesso' : 'Aperto adesso'}
              </Text>
            </Pressable>
            <View style={styles.modes}>
              <Chip
                label="Tutta la città"
                selected={filters.mode === 'city'}
                onPress={() => setFilters({ mode: 'city' })}
              />
              <Chip
                label="Centro città"
                selected={filters.mode === 'point' && filters.center?.label === CITY_CENTER.label}
                onPress={() => setFilters({ mode: 'point', center: CITY_CENTER })}
              />
              <Chip
                label={locating ? 'Posizione…' : 'Usa la mia posizione'}
                selected={filters.mode === 'point' && filters.center?.label === 'La tua posizione'}
                onPress={() => {
                  if (locating) return;
                  setLocating(true);
                  setLocationMessage(null);
                  void readCurrentCoordinates().then((position) => {
                    setLocating(false);
                    if (!position.ok) {
                      setLocationMessage(position.message);
                      return;
                    }
                    setFilters({
                      mode: 'point',
                      center: {
                        latitude: position.latitude,
                        longitude: position.longitude,
                        label: 'La tua posizione',
                      },
                    });
                  });
                }}
              />
            </View>
            {filters.mode === 'point' ? (
              <View style={styles.modes}>
                {RADII.map((radius) => (
                  <Chip
                    key={radius}
                    label={radius < 1000 ? `${radius} m` : `${radius / 1000} km`}
                    selected={filters.radiusMeters === radius}
                    onPress={() => setFilters({ radiusMeters: radius })}
                  />
                ))}
              </View>
            ) : null}
            {locationMessage ? <Text style={styles.note}>{locationMessage}</Text> : null}
            <Text style={styles.count}>
              {result.total === 1 ? '1 esercizio' : `${result.total} esercizi`}
              {filters.center && filters.mode === 'point' ? ` · ${filters.center.label}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <BusinessCard hit={item} onPress={() => router.push(`/business/${item.business.id}`)} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {filters.openNow
              ? 'Nessun esercizio risulta aperto con questi filtri. Quelli senza orari non vengono considerati aperti.'
              : 'Nessun esercizio corrisponde alla ricerca.'}
          </Text>
        }
        ListFooterComponent={
          result.items.length < result.total ? (
            <Pressable accessibilityRole="button" onPress={() => setLimit((value) => value + 20)} style={styles.more}>
              <Text style={styles.moreText}>Mostra altri</Text>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { padding: space.lg, gap: space.md },
  kicker: { color: colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontWeight: '700' },
  chipTextOn: { color: colors.onPrimary },
  toggle: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: space.md,
  },
  toggleOn: { backgroundColor: colors.openBg, borderColor: colors.openInk },
  toggleText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  toggleTextOn: { color: colors.openInk },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { color: colors.unknownInk, fontSize: 14, lineHeight: 20 },
  count: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 22, paddingHorizontal: space.lg },
  more: { alignItems: 'center', padding: space.lg },
  moreText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
