import type { WeeklyInterval } from '../domain/opening-hours/schedule';
import type { ImportedPlace } from '../domain/import/provider';

export const PILOT_CITY_ID = 'bologna';
export const PILOT_PROVIDER = 'pilot_fixture';
export const PILOT_ATTRIBUTION =
  'Catalogo dimostrativo di Bologna. Non proviene da un provider esterno con licenza da verificare.';

export const CITY_CENTER = { latitude: 44.49381, longitude: 11.34295, label: 'Centro di Bologna' };

function shifts(days: number[], ranges: Array<[string, string]>): WeeklyInterval[] {
  return days.flatMap((dayOfWeek) =>
    ranges.map(([opensAt, closesAt]) => ({ dayOfWeek, opensAt, closesAt })),
  );
}

const ALL = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS = [1, 2, 3, 4, 5, 6];

export const PILOT_PLACES: ImportedPlace[] = [
  {
    externalId: 'cafe-zanarini',
    name: 'Caffè Zanarini',
    category: 'caffetteria',
    latitude: 44.4933,
    longitude: 11.3434,
    address: 'Piazza Galvani 1, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: {
      intervals: [
        ...shifts(WEEKDAYS, [
          ['07:30', '12:30'],
          ['15:00', '19:30'],
        ]),
        ...shifts([7], [['08:00', '13:00']]),
      ],
    },
  },
  {
    externalId: 'osteria-bottega',
    name: 'Osteria Bottega',
    category: 'ristorante',
    latitude: 44.4918,
    longitude: 11.3397,
    address: 'Via Santa Caterina 51, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: {
      intervals: [
        ...shifts([1, 2, 3], [
          ['12:00', '14:30'],
          ['19:00', '23:00'],
        ]),
        ...shifts([4, 5, 6], [
          ['12:00', '14:30'],
          ['19:00', '01:00'],
        ]),
      ],
    },
  },
  {
    externalId: 'farmacia-notturna',
    name: 'Farmacia Comunale Notturna',
    category: 'farmacia',
    latitude: 44.4948,
    longitude: 11.3461,
    address: 'Via Indipendenza 44, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(ALL, [['00:00', '24:00']]) },
  },
  {
    externalId: 'libreria-nanni',
    name: 'Libreria Nanni',
    category: 'libreria',
    latitude: 44.4954,
    longitude: 11.3409,
    address: "Via de' Musei 8, Bologna",
    attribution: PILOT_ATTRIBUTION,
  },
  {
    externalId: 'gelateria-gianni',
    name: 'Gelateria Gianni',
    category: 'gelateria',
    latitude: 44.4971,
    longitude: 11.3479,
    address: 'Via delle Moline 12, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(ALL, [['12:00', '23:00']]) },
  },
  {
    externalId: 'forno-brisa',
    name: 'Forno Brisa',
    category: 'panificio',
    latitude: 44.4966,
    longitude: 11.3388,
    address: 'Via San Felice 20, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(WEEKDAYS, [['08:00', '13:00']]) },
  },
  {
    externalId: 'bar-pratello',
    name: 'Bar del Pratello',
    category: 'bar',
    latitude: 44.4922,
    longitude: 11.3364,
    address: 'Via del Pratello 18, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(ALL, [['08:00', '20:00']]) },
  },
  {
    externalId: 'mercato-erbe',
    name: 'Mercato delle Erbe',
    category: 'supermercato',
    latitude: 44.4941,
    longitude: 11.3401,
    address: 'Via Ugo Bassi 25, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(WEEKDAYS, [['07:00', '14:00']]) },
  },
  {
    externalId: 'atelier-indipendenza',
    name: 'Atelier Indipendenza',
    category: 'abbigliamento',
    latitude: 44.5002,
    longitude: 11.3438,
    address: 'Via Indipendenza 45, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: { intervals: shifts(WEEKDAYS, [['10:00', '19:30']]) },
  },
  {
    externalId: 'trattoria-san-luca',
    name: 'Trattoria di San Luca',
    category: 'ristorante',
    latitude: 44.518,
    longitude: 11.355,
    address: 'Via di San Luca 36, Bologna',
    attribution: PILOT_ATTRIBUTION,
    openingHours: {
      intervals: shifts([2, 3, 4, 5, 6, 7], [
        ['12:00', '15:00'],
        ['19:00', '22:30'],
      ]),
    },
  },
];
