export type RunewordVariant = {
  itemType: string;
  sockets: number;
  stats: string[];
};

export type Runeword = {
  id: string;
  name: string;
  url: string | null;
  patch: string | null;
  version: string | null;
  level: number;
  sockets: number;
  runes: string[];
  itemTypes: string[];
  itemGroups: string[];
  stats: string[];
  variants: RunewordVariant[];
  ladder: boolean;
  nonLadder: boolean;
  ladderNote: string;
};

export type LadderFilter = 'all' | 'ladder' | 'nonLadder';

export type RunewordFilters = {
  query: string;
  sockets: number[];
  itemType: string | null;
  ladder: LadderFilter;
};
