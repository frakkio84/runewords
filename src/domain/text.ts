export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenJaccard(left: string, right: string): number {
  const a = new Set(normalizeName(left).split(' ').filter(Boolean));
  const b = new Set(normalizeName(right).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earth = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(latitudeB - latitudeA);
  const dLng = toRad(longitudeB - longitudeA);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(latitudeA)) * Math.cos(toRad(latitudeB)) * sinLng * sinLng;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

const CATEGORY_ALIASES: Record<string, string> = {
  cafe: 'caffetteria',
  coffee: 'caffetteria',
  caffè: 'caffetteria',
  caffe: 'caffetteria',
  bar: 'bar',
  restaurant: 'ristorante',
  ristorante: 'ristorante',
  pharmacy: 'farmacia',
  farmacia: 'farmacia',
  bakery: 'panificio',
  panificio: 'panificio',
  bookshop: 'libreria',
  bookstore: 'libreria',
  libreria: 'libreria',
  supermarket: 'supermercato',
  supermercato: 'supermercato',
  clothes: 'abbigliamento',
  abbigliamento: 'abbigliamento',
  gelato: 'gelateria',
  gelateria: 'gelateria',
  mercato: 'supermercato',
};

export function canonicalCategory(value: string | undefined): string {
  if (!value) return 'altro';
  const key = normalizeName(value);
  return CATEGORY_ALIASES[key] ?? key.replace(/\s+/g, '_') ?? 'altro';
}
