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
}

/** @throws UnknownAirportError */
export function getAirportInfo(iata: string): AirportInfo {
  const tz = timezones[iata];
  const g = geo[iata];
  if (!tz || !g) throw new UnknownAirportError(iata);
  return { timezone: tz, ...g };
}