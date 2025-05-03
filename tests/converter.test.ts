import dayjs from 'dayjs';
import { convertToUTC, convertLocalToUTCByZone } from '../src/converter';
import {
  UnknownAirportError,
  InvalidTimestampError,
  UnknownTimezoneError
} from '../src/errors';
import { timezones } from '../src/mapping/timezones';

// Dynamically find the first 3-letter code not in our mapping
function getInvalidIata(): string {
  const existing = new Set(Object.keys(timezones));
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      for (let c = 65; c <= 90; c++) {
        const code = String.fromCharCode(a, b, c);
        if (!existing.has(code)) return code;
      }
    }
  }
  throw new Error('All 3-letter codes are taken?!');
}

const invalidIata = getInvalidIata();

describe('convertToUTC (Day.js)', () => {
  it('converts JFK local time (UTC–4 in May) correctly', () => {
    expect(convertToUTC('2025-05-02T14:30', 'JFK'))
        .toBe('2025-05-02T18:30:00Z');
  });

  it('throws UnknownAirportError for bad IATA', () => {
    expect(() => convertToUTC('2025-05-02T14:30', invalidIata))
        .toThrow(UnknownAirportError);
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() => convertToUTC('invalid-format', 'JFK'))
        .toThrow(InvalidTimestampError);
  });

  it('throws InvalidTimestampError if dayjs.tz unexpectedly throws', () => {
    const orig = (dayjs as any).tz;
    (dayjs as any).tz = () => { throw new Error(); };
    try {
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK'))
          .toThrow(InvalidTimestampError);
    } finally {
      (dayjs as any).tz = orig;
    }
  });
});

describe('convertLocalToUTCByZone', () => {
  it('converts London local time to UTC', () => {
    expect(convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London'))
        .toBe('2025-05-02T13:30:00Z');
  });

  it('throws UnknownTimezoneError for invalid tz', () => {
    expect(() =>
        convertLocalToUTCByZone('2025-05-02T14:30:00', 'Invalid/Zone')
    ).toThrow(UnknownTimezoneError);
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() =>
        convertLocalToUTCByZone('bad-format', 'Europe/London')
    ).toThrow(InvalidTimestampError);
  });
});
