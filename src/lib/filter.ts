import type { Runeword, RunewordFilters } from '../types';
import { matchesItemType } from './itemTypes';

export function filterRunewords(
  runewords: Runeword[],
  filters: RunewordFilters,
): Runeword[] {
  const query = filters.query.trim().toLowerCase();

  return runewords
    .filter((runeword) => {
      if (
        filters.sockets.length > 0 &&
        !filters.sockets.includes(runeword.sockets)
      ) {
        return false;
      }

      if (filters.ladder === 'ladder' && runeword.ladderStatus !== 'ladder') {
        return false;
      }

      if (filters.ladder === 'nonLadder' && runeword.ladderStatus === 'ladder') {
        return false;
      }

      if (
        filters.itemType &&
        !matchesItemType(runeword.itemTypes, filters.itemType)
      ) {
        return false;
      }

      if (query) {
        const haystack = [
          runeword.name,
          runeword.runes.join(' '),
          runeword.runes.join(''),
          runeword.itemTypes.join(' '),
          runeword.patch ?? '',
          runeword.ladderNote,
          ...runeword.variants.flatMap((variant) => variant.stats),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export const EMPTY_FILTERS: RunewordFilters = {
  query: '',
  sockets: [],
  itemType: null,
  ladder: 'all',
};

export function toggleSocket(
  selected: number[],
  socketCount: number,
): number[] {
  return selected.includes(socketCount)
    ? selected.filter((value) => value !== socketCount)
    : [...selected, socketCount].sort((left, right) => left - right);
}
