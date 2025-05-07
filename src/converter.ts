import { parseISO } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { timezones } from './mapping/timezones';
import {
  UnknownAirportError,
  InvalidTimestampError,
  UnknownTimezoneError
} from './errors';

const ISO_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function parseLocalIso(
    localIso: string
): [number, number, number, number, number, number] {
  const m = ISO_LOCAL_RE.exec(localIso);
  if (!m) throw new InvalidTimestampError(localIso);
  const [, Y, Mo, D, h, mi, s] = m;
  return [
    Number(Y),
    Number(Mo) - 1,
    Number(D),
    Number(h),
    Number(mi),
    s ? Number(s) : 0
  ];
}

/**
 * Convert a local ISO‐8601 string at an airport (IATA) into a UTC ISO string.
 * Always emits "YYYY-MM-DDTHH:mm:ssZ" (no milliseconds).
 */
export function convertToUTC(localIso: string, iata: string): string {
  const tz = timezones[iata];
  if (!tz) throw new UnknownAirportError(iata);

  // Quick semantic check
  const base = parseISO(localIso);
  if (isNaN(base.getTime())) throw new InvalidTimestampError(localIso);

  const [year, month, day, hour, minute, second] = parseLocalIso(localIso);

  let zoned: TZDate;
  try {
    zoned = TZDate.tz(tz, year, month, day, hour, minute, second);
  } catch {
    throw new InvalidTimestampError(localIso);
  }
  if (isNaN(zoned.getTime())) throw new InvalidTimestampError(localIso);

  // Strip ".000" from the ISO string
  return new Date(zoned.getTime()).toISOString().replace('.000Z', 'Z');
}

/**
 * Convert a local ISO‐8601 string in any IANA timezone into a UTC ISO string.
 * Always emits "YYYY-MM-DDTHH:mm:ssZ" (no milliseconds).
 */
export function convertLocalToUTCByZone(
    localIso: string,
    timeZone: string
): string {
  // Validate timezone
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new UnknownTimezoneError(timeZone);
  }

  // Quick semantic check
  const base = parseISO(localIso);
  if (isNaN(base.getTime())) throw new InvalidTimestampError(localIso);

  const [year, month, day, hour, minute, second] = parseLocalIso(localIso);

  let zoned: TZDate;
  try {
    zoned = TZDate.tz(timeZone, year, month, day, hour, minute, second);
  } catch {
    throw new UnknownTimezoneError(timeZone);
  }
  if (isNaN(zoned.getTime())) throw new InvalidTimestampError(localIso);

  return new Date(zoned.getTime()).toISOString().replace('.000Z', 'Z');
}
