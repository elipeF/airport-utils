import { timezones } from './mapping/timezones';
import { geo, GeoEntry } from './mapping/geo';
import { UnknownAirportError } from './errors';

export interface AirportInfo {
  timezone: string;
  latitude: number;
  longitude: number;
  name: string;
  city: string;
  country: string;
  countryName: string;
  continent: string;
}

/** @throws UnknownAirportError */
export function getAirportInfo(iata: string): AirportInfo {
  const tz = timezones[iata];
  const g = geo[iata];
  if (!tz || !g) throw new UnknownAirportError(iata);
  return { timezone: tz, ...g };
}

export interface Airport extends AirportInfo {
  iata: string;
}

export function getAllAirports(): Airport[] {
  return Object.keys(geo).map(iata => {
    const tz = timezones[iata];
    const g = geo[iata];
    return { iata, timezone: tz, ...g };
  });
}