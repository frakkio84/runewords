import { readFileSync } from 'node:fs';
import { EMPTY_FILTERS, filterRunewords } from '../src/lib/filter';
import type { Runeword, RunewordFilters } from '../src/types';

const runewords = JSON.parse(
  readFileSync(new URL('../src/data/runewords.json', import.meta.url), 'utf8'),
) as Runeword[];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function names(filters: Partial<RunewordFilters>): string[] {
  return filterRunewords(runewords, { ...EMPTY_FILTERS, ...filters }).map(
    (runeword) => runeword.name,
  );
}

assert(runewords.length === 100, `expected 100 runewords, got ${runewords.length}`);
assert(names({}).includes('Enigma'), 'Enigma should be listed');
assert(names({ query: 'jah ith ber' }).includes('Enigma'), 'search by runes');
assert(names({ sockets: [3] }).every((name) => {
  const runeword = runewords.find((item) => item.name === name);
  return runeword?.sockets === 3;
}), '3-rune filter should only return 3-socket words');

const swords = names({ itemType: 'Swords' });
assert(swords.includes('Spirit'), 'Spirit swords');
assert(swords.includes('Grief'), 'Grief swords');
assert(swords.includes('Breath of the Dying'), 'all-weapon words match Swords');
assert(!swords.includes('Enigma'), 'armor should not match Swords');

const armor = names({ itemType: 'Body Armor' });
assert(armor.includes('Enigma'), 'Enigma armor');
assert(armor.includes('Hustle'), 'Hustle armor variant');
assert(!armor.includes('Spirit'), 'Spirit is not body armor');

const missile = names({ itemType: 'Missile Weapons' });
assert(missile.includes('Faith'), 'Faith bows');
assert(missile.includes('Harmony'), 'Harmony bows');
assert(missile.includes('Insight'), 'Insight can be a missile weapon');

const ladder = names({ ladder: 'ladder' });
assert(ladder.includes('Hustle'), 'Hustle is ladder');
assert(!ladder.includes('Mosaic'), 'Mosaic is not ladder');
assert(!ladder.includes('Enigma'), 'unrestricted words are not ladder');
assert(!ladder.includes('Mania'), 'dual-availability words are not ladder');
assert(
  ladder.every((name) => {
    const runeword = runewords.find((item) => item.name === name);
    return runeword?.ladderStatus === 'ladder';
  }),
  'Ladder filter must use ladderStatus',
);
assert(ladder.length === 1, `expected 1 ladder word, got ${ladder.length}`);

const nonLadder = names({ ladder: 'nonLadder' });
assert(nonLadder.includes('Mosaic'), 'Mosaic is non-ladder');
assert(!nonLadder.includes('Hustle'), 'Hustle is not non-ladder');
assert(!nonLadder.includes('Enigma'), 'unrestricted words are not non-ladder');
assert(
  nonLadder.every((name) => {
    const runeword = runewords.find((item) => item.name === name);
    return runeword?.ladderStatus === 'nonLadder';
  }),
  'Non-Ladder filter must use ladderStatus',
);
assert(nonLadder.length === 1, `expected 1 non-ladder word, got ${nonLadder.length}`);

assert(names({ ladder: 'all' }).length === 100, 'All shows every runeword');
assert(
  runewords.every((runeword) =>
    ['ladder', 'nonLadder', 'all'].includes(runeword.ladderStatus),
  ),
  'every runeword has a ladderStatus property',
);

const paladin = names({ itemType: 'Paladin Shields' });
assert(paladin.includes('Exile'), 'Exile paladin shields');
assert(paladin.includes('Vigilance'), 'Vigilance targes are paladin shields');
assert(!names({ itemType: 'Shields' }).includes('Exile'), 'Exile is not a generic shield');
assert(names({ itemType: 'Shields' }).includes('Spirit'), 'Spirit shields');
assert(names({ itemType: 'Weapons' }).includes('Hustle'), 'Hustle weapons variant');

assert(names({ query: 'teleport' }).includes('Enigma'), 'search stats');
assert(names({ sockets: [6] }).includes('Last Wish'), '6 rune Last Wish');

console.log(`ok — ${runewords.length} runewords, filters verified`);
