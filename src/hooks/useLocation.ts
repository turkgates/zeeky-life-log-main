import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationResult {
  lat: number;
  lon: number;
  displayName: string;
  shortName: string;
}

interface NominatimAddress {
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  country?: string;
}

interface NominatimResponse {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

export async function getCurrentLocation(): Promise<LocationResult | null> {
  try {
    if (!Capacitor.isNativePlatform()) return null;

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    const { latitude: lat, longitude: lon } = position.coords;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Zeeky-App/1.0',
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as NominatimResponse;

    const displayName = data.display_name ?? '';
    const address = data.address ?? {};
    const locality = address.city ?? address.town ?? address.village ?? '';
    const road = address.road ?? '';
    const shortName = data.name
      ? data.name
      : road
        ? `${road}${locality ? ', ' + locality : ''}`
        : locality
          ? locality
          : displayName.split(',')[0] ?? '';

    return {
      lat,
      lon,
      displayName,
      shortName,
    };
  } catch {
    return null;
  }
}
