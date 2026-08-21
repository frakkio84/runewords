import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Runeword, RunewordVariant } from '../types';
import { colors, fonts } from '../theme';

type RunewordDetailProps = {
  runeword: Runeword;
};

function variantsToShow(runeword: Runeword): RunewordVariant[] {
  const uniqueStats = new Set(
    runeword.variants.map((variant) => variant.stats.join('\n')),
  );
  if (uniqueStats.size <= 1) {
    return [
      {
        itemType: runeword.itemTypes.join(', '),
        sockets: runeword.sockets,
        stats: runeword.variants[0]?.stats ?? runeword.stats,
      },
    ];
  }
  return runeword.variants;
}

export function RunewordDetail({ runeword }: RunewordDetailProps) {
  const variants = variantsToShow(runeword);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.name}>{runeword.name}</Text>
      <Text style={styles.runes}>{runeword.runes.join('  →  ')}</Text>
      <Text style={styles.meta}>
        {runeword.sockets} sockets · Required level {runeword.level}
        {runeword.patch ? ` · Patch ${runeword.patch}` : ''}
      </Text>
      <Text style={styles.note}>{runeword.ladderNote}</Text>
      {runeword.version ? (
        <Text style={styles.version}>{runeword.version}</Text>
      ) : null}

      {variants.map((variant) => (
        <View key={`${variant.itemType}-${variant.sockets}`} style={styles.block}>
          <Text style={styles.itemType}>{variant.itemType}</Text>
          {variant.stats.map((stat) => (
            <Text key={stat} style={styles.stat}>
              {stat}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  name: {
    color: colors.unique,
    fontFamily: fonts.title,
    fontSize: 32,
    marginBottom: 8,
  },
  runes: {
    color: colors.rune,
    fontSize: 18,
    marginBottom: 10,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 6,
  },
  note: {
    color: colors.goldDim,
    fontSize: 13,
    marginBottom: 4,
  },
  version: {
    color: colors.faint,
    fontSize: 12,
    marginBottom: 12,
  },
  block: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  itemType: {
    color: colors.gold,
    fontFamily: fonts.title,
    fontSize: 16,
    marginBottom: 10,
  },
  stat: {
    color: colors.magic,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
});
