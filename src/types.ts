export type RunewordVariant = {
  itemType: string;
  sockets: number;
  stats: string[];
};

export type LadderFilter = 'ladder' | 'nonLadder' | 'all';

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
  ladderStatus: LadderFilter;
  ladderNote: string;
};

export type RunewordFilters = {
  query: string;
  sockets: number[];
  itemType: string | null;
  ladder: LadderFilter;
};
