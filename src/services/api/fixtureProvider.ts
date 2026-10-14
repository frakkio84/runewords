import type { ImportedPlace, PlacesProvider } from '../../domain/import/provider';
import { distanceMeters, normalizeName } from '../../domain/text';
import { PILOT_PLACES } from '../../data/pilotPlaces';

/** Local stand-in for a places provider. It does not call a licensed external API. */
export class FixturePlacesProvider implements PlacesProvider {
  async searchPlaces(params: {
    cityId: string;
    query?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  }): Promise<ImportedPlace[]> {
    const query = params.query ? normalizeName(params.query) : '';
    return PILOT_PLACES.filter((place) => {
      if (query && !normalizeName(place.name).includes(query)) return false;
      if (
        params.latitude !== undefined &&
        params.longitude !== undefined &&
        params.radiusMeters !== undefined &&
        distanceMeters(params.latitude, params.longitude, place.latitude, place.longitude) > params.radiusMeters
      ) {
        return false;
      }
      return true;
    });
  }

  async getPlace(externalId: string): Promise<ImportedPlace | null> {
    return PILOT_PLACES.find((place) => place.externalId === externalId) ?? null;
  }
}
