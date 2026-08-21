export const WEAPON_TYPES = [
  'Axes',
  'Swords',
  'Daggers',
  'Maces',
  'Hammers',
  'Clubs',
  'Scepters',
  'Wands',
  'Staves',
  'Polearms',
  'Spears',
  'Katars',
  'Missile Weapons',
  'Melee Weapons',
  'Weapons',
] as const;

export const MELEE_TYPES = [
  'Axes',
  'Swords',
  'Daggers',
  'Maces',
  'Hammers',
  'Clubs',
  'Scepters',
  'Wands',
  'Staves',
  'Polearms',
  'Spears',
  'Katars',
  'Melee Weapons',
] as const;

export const ITEM_TYPE_FILTERS = [
  'Weapons',
  'Melee Weapons',
  'Missile Weapons',
  'Axes',
  'Swords',
  'Daggers',
  'Maces',
  'Hammers',
  'Clubs',
  'Scepters',
  'Wands',
  'Staves',
  'Polearms',
  'Spears',
  'Katars',
  'Body Armor',
  'Helms',
  'Shields',
  'Paladin Shields',
  'Grimoires',
  'Shrunken Heads',
  'Targes',
] as const;

const WEAPON_SET = new Set<string>(WEAPON_TYPES);
const MELEE_SET = new Set<string>(MELEE_TYPES);

export function matchesItemType(
  runewordTypes: string[],
  selected: string,
): boolean {
  if (runewordTypes.includes(selected)) {
    return true;
  }

  if (selected === 'Weapons') {
    return runewordTypes.some((type) => WEAPON_SET.has(type));
  }

  if (selected === 'Melee Weapons') {
    return runewordTypes.some(
      (type) => MELEE_SET.has(type) || type === 'Weapons',
    );
  }

  if (selected === 'Missile Weapons') {
    return runewordTypes.includes('Weapons');
  }

  if (WEAPON_SET.has(selected) && selected !== 'Missile Weapons') {
    if (runewordTypes.includes('Weapons')) {
      return true;
    }
    if (selected !== 'Melee Weapons' && runewordTypes.includes('Melee Weapons')) {
      return MELEE_SET.has(selected);
    }
  }

  if (selected === 'Paladin Shields') {
    return runewordTypes.includes('Targes');
  }

  return false;
}
