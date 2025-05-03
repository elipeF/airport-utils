import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { timezones } from './mapping/timezones';
import {
  UnknownAirportError,
  InvalidTimestampError,
  UnknownTimezoneError
} from './errors';

// Initialize plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Convert local ISO 8601 (YYYY-MM-DDTHH:mm) at an airport into UTC ISO string.
 * @throws UnknownAirportError | InvalidTimestampError
 */
export function convertToUTC(localIso: string, iata: string): string {
  const tz = timezones[iata];
  if (!tz) throw new UnknownAirportError(iata);

  // 1) Pre-validate timestamp
  const localDt = dayjs(localIso, /* no format, ISO parse */);
  if (!localDt.isValid()) throw new InvalidTimestampError(localIso);

  // 2) Then apply timezone conversion
  let dt;
  try {
    dt = dayjs.tz(localIso, tz);
  } catch {
    // Shouldn't happen for valid tz, but just in case:
    throw new InvalidTimestampError(localIso);
  }

  return dt.utc().format(); // "YYYY-MM-DDTHH:mm:ssZ"
}

/**
 * Convert local ISO 8601 string in any IANA timezone to UTC ISO string.
 * @throws UnknownTimezoneError | InvalidTimestampError
 */
export function convertLocalToUTCByZone(
    localIso: string,
    timeZone: string
): string {
  // 1) Validate timestamp first
  const localDt = dayjs(localIso);
  if (!localDt.isValid()) throw new InvalidTimestampError(localIso);

  // 2) Apply timezone, catching only invalid timezone errors
  let dt;
  try {
    dt = dayjs.tz(localIso, timeZone);
  } catch {
    throw new UnknownTimezoneError(timeZone);
  }

  return dt.utc().format();
}
