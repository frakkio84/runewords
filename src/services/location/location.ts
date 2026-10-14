import * as Location from 'expo-location';

export async function readCurrentCoordinates(): Promise<
  { ok: true; latitude: number; longitude: number } | { ok: false; message: string }
> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return {
        ok: false,
        message: 'Posizione non disponibile. Puoi cercare per nome in tutta la città.',
      };
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { ok: true, latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return {
      ok: false,
      message: 'Non riesco a leggere la posizione. La ricerca per nome resta disponibile.',
    };
  }
}
