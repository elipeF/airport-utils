import { TZDate } from '@date-fns/tz';
import { timezones } from './mapping/timezones';
import { UnknownAirportError, InvalidTimestampError, UnknownTimezoneError } from './errors';

const ISO_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type LocalDateTimeParts = [number, number, number, number, number, number];

const VALID_TIMEZONE_CACHE = new Map<string, boolean>();

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  if (month === 3 || month === 5 || month === 8 || month === 10) return 30;
  return 31;
}

function parseLocalIsoStrict(localIso: string): LocalDateTimeParts {
  const m = ISO_LOCAL_RE.exec(localIso);
  if (!m) throw new InvalidTimestampError(localIso);
  const [, Y, Mo, D, h, mi, s] = m;
  const year = Number(Y);
  const month = Number(Mo) - 1;
  const day = Number(D);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s ? Number(s) : 0;

  if (month < 0 || month > 11) throw new InvalidTimestampError(localIso);
  if (day < 1 || day > daysInMonth(year, month)) throw new InvalidTimestampError(localIso);
  if (hour < 0 || hour > 23) throw new InvalidTimestampError(localIso);
  if (minute < 0 || minute > 59) throw new InvalidTimestampError(localIso);
  if (second < 0 || second > 59) throw new InvalidTimestampError(localIso);

  return [year, month, day, hour, minute, second];
}

function assertValidTimezone(timeZone: string): void {
  const cached = VALID_TIMEZONE_CACHE.get(timeZone);
  if (cached === true) return;
  if (cached === false) throw new UnknownTimezoneError(timeZone);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    VALID_TIMEZONE_CACHE.set(timeZone, true);
  } catch {
    VALID_TIMEZONE_CACHE.set(timeZone, false);
    throw new UnknownTimezoneError(timeZone);
  }
}

function toUtcIso(
  localIso: string,
  timeZone: string,
  onTimeZoneError: (err: unknown) => Error
): string {
  const [year, month, day, hour, minute, second] = parseLocalIsoStrict(localIso);

  let zoned: TZDate;
  try {
    zoned = TZDate.tz(timeZone, year, month, day, hour, minute, second);
  } catch (err) {
    throw onTimeZoneError(err);
  }
  if (isNaN(zoned.getTime())) throw new InvalidTimestampError(localIso);

  // Strip ".000" from the ISO string
  return new Date(zoned.getTime()).toISOString().replace('.000Z', 'Z');
}

/**
 * Convert a local ISO‐8601 string at an airport (IATA) into a UTC ISO string.
 * Always emits "YYYY-MM-DDTHH:mm:ssZ" (no milliseconds).
 */
export function convertToUTC(localIso: string, iata: string): string {
  const tz = timezones[iata];
  if (!tz) throw new UnknownAirportError(iata);

  return toUtcIso(localIso, tz, () => new InvalidTimestampError(localIso));
}

/**
 * Convert a local ISO‐8601 string in any IANA timezone into a UTC ISO string.
 * Always emits "YYYY-MM-DDTHH:mm:ssZ" (no milliseconds).
 */
export function convertLocalToUTCByZone(localIso: string, timeZone: string): string {
  assertValidTimezone(timeZone);
  return toUtcIso(localIso, timeZone, () => new UnknownTimezoneError(timeZone));
}
