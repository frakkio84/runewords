import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Runeword } from '../types';
import { colors, fonts } from '../theme';

type RunewordCardProps = {
  runeword: Runeword;
  onPress: () => void;
};

function ladderLabel(runeword: Runeword): { text: string; color: string } {
  if (runeword.ladder && !runeword.nonLadder) {
    return { text: 'Ladder only', color: colors.ladder };
  }
  if (runeword.nonLadder && !runeword.ladder) {
    return { text: 'Non-Ladder only', color: colors.nonLadder };
  }
  if (runeword.ladderNote.startsWith('Still Ladder only')) {
    return { text: 'Ladder only in LoD', color: colors.ladder };
  }
  return { text: 'Ladder & Non-Ladder', color: colors.muted };
}

export function RunewordCard({ runeword, onPress }: RunewordCardProps) {
  const ladder = ladderLabel(runeword);

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.top}>
        <Text style={styles.name}>{runeword.name}</Text>
        <Text style={[styles.ladder, { color: ladder.color }]}>
          {ladder.text}
        </Text>
      </View>
      <Text style={styles.runes}>{runeword.runes.join('  →  ')}</Text>
      <Text style={styles.meta}>
        {runeword.sockets} runes · {runeword.itemTypes.join(', ')} · clvl{' '}
        {runeword.level}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  name: {
    color: colors.unique,
    fontFamily: fonts.title,
    fontSize: 20,
    flex: 1,
  },
  ladder: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
    maxWidth: 130,
  },
  runes: {
    color: colors.rune,
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 0.3,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
});
