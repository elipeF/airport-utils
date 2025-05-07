import { convertToUTC, convertLocalToUTCByZone } from '../src/converter';
import {
  UnknownAirportError,
  InvalidTimestampError,
  UnknownTimezoneError
} from '../src/errors';
import { timezones } from '../src/mapping/timezones';

const { TZDate } = require('@date-fns/tz');

// Dynamically find an invalid 3-letter IATA
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
  throw new Error('All codes taken?!');
}
const invalidIata = getInvalidIata();

describe('convertToUTC', () => {
  it('converts JFK local time (UTC–4 in May) correctly', () => {
    expect(convertToUTC('2025-05-02T14:30', 'JFK'))
        .toBe('2025-05-02T18:30:00Z');
  });

  it('throws UnknownAirportError for bad IATA', () => {
    expect(() => convertToUTC('2025-05-02T14:30', invalidIata))
        .toThrow(UnknownAirportError);
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() => convertToUTC('not-a-timestamp', 'JFK'))
        .toThrow(InvalidTimestampError);
  });

  it('throws InvalidTimestampError for fractional seconds format', () => {
    expect(() => convertToUTC('2025-05-02T14:30:00.123', 'JFK'))
        .toThrow(InvalidTimestampError);
  });

  describe('error branches', () => {
    const original = TZDate.tz;
    afterEach(() => { TZDate.tz = original; });

    it('throws InvalidTimestampError if TZDate.tz throws', () => {
      TZDate.tz = () => { throw new Error('forced'); };
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK'))
          .toThrow(InvalidTimestampError);
    });

    it('throws InvalidTimestampError if TZDate.tz returns invalid Date', () => {
      TZDate.tz = () => {
        const d = new Date(NaN);
        Object.setPrototypeOf(d, TZDate.prototype);
        return d;
      };
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK'))
          .toThrow(InvalidTimestampError);
    });
  });
});

describe('convertLocalToUTCByZone', () => {
  it('converts London local time to UTC', () => {
    expect(convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London'))
        .toBe('2025-05-02T13:30:00Z');
  });

  it('throws UnknownTimezoneError for invalid tz', () => {
    expect(() =>
        convertLocalToUTCByZone('2025-05-02T14:30:00', 'Not/A_Zone')
    ).toThrow(UnknownTimezoneError);
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() =>
        convertLocalToUTCByZone('bad-format', 'Europe/London')
    ).toThrow(InvalidTimestampError);
  });

  it('throws InvalidTimestampError for fractional seconds format', () => {
    expect(() =>
        convertLocalToUTCByZone('2025-05-02T14:30:00.123', 'Europe/London')
    ).toThrow(InvalidTimestampError);
  });

  describe('error branches', () => {
    const original = TZDate.tz;
    afterEach(() => { TZDate.tz = original; });

    it('throws UnknownTimezoneError if TZDate.tz throws for valid zone', () => {
      TZDate.tz = () => { throw new RangeError('forced'); };
      expect(() =>
          convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')
      ).toThrow(UnknownTimezoneError);
    });

    it('throws InvalidTimestampError if TZDate.tz returns invalid Date', () => {
      TZDate.tz = () => {
        const d = new Date(NaN);
        Object.setPrototypeOf(d, TZDate.prototype);
        return d;
      };
      expect(() =>
          convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')
      ).toThrow(InvalidTimestampError);
    });
  });
});
