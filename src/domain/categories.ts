export const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'bar', label: 'Bar' },
  { id: 'caffetteria', label: 'Caffetteria' },
  { id: 'ristorante', label: 'Ristorante' },
  { id: 'gelateria', label: 'Gelateria' },
  { id: 'farmacia', label: 'Farmacia' },
  { id: 'panificio', label: 'Panificio' },
  { id: 'libreria', label: 'Libreria' },
  { id: 'supermercato', label: 'Supermercato' },
  { id: 'abbigliamento', label: 'Abbigliamento' },
];

export function categoryLabel(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.label ?? id;
}
