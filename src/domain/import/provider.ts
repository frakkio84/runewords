import type { WeeklyInterval } from '../opening-hours/schedule';

export type WeeklySchedule = {
  intervals: WeeklyInterval[];
};

/**
 * Internal contract. Adapters may return only the fields the provider's
 * terms allow the app to store and display.
 */
export type ImportedPlace = {
  externalId: string;
  name: string;
  category?: string;
  latitude: number;
  longitude: number;
  address?: string;
  openingHours?: WeeklySchedule;
  attribution?: string;
};

export interface PlacesProvider {
  searchPlaces(params: {
    cityId: string;
    query?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  }): Promise<ImportedPlace[]>;

  getPlace(externalId: string): Promise<ImportedPlace | null>;
}
