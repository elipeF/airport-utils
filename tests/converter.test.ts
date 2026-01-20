import { TZDate } from '@date-fns/tz';
import { convertToUTC, convertLocalToUTCByZone } from '../src/converter';
import { UnknownAirportError, InvalidTimestampError, UnknownTimezoneError } from '../src/errors';
import { getInvalidIata } from './helpers';

const invalidIata = getInvalidIata();

describe('convertToUTC', () => {
  it('converts JFK local time (UTC–4 in May) correctly', () => {
    expect(convertToUTC('2025-05-02T14:30', 'JFK')).toBe('2025-05-02T18:30:00Z');
  });

  it('throws UnknownAirportError for bad IATA', () => {
    expect(() => convertToUTC('2025-05-02T14:30', invalidIata)).toThrow(UnknownAirportError);
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() => convertToUTC('not-a-timestamp', 'JFK')).toThrow(InvalidTimestampError);
  });

  it('throws InvalidTimestampError for invalid date components', () => {
    expect(() => convertToUTC('2025-13-02T14:30', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-02-30T14:30', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-04-31T14:30', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-05-02T25:30', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-05-02T23:60', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-05-02T23:59:60', 'JFK')).toThrow(InvalidTimestampError);
  });

  it('throws InvalidTimestampError for fractional seconds format', () => {
    expect(() => convertToUTC('2025-05-02T14:30:00.123', 'JFK')).toThrow(InvalidTimestampError);
  });

  describe('error branches', () => {
    it('throws InvalidTimestampError if TZDate.tz throws', () => {
      const spy = jest.spyOn(TZDate, 'tz').mockImplementation(() => {
        throw new Error('forced');
      });
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK')).toThrow(InvalidTimestampError);
      spy.mockRestore();
    });

    it('throws InvalidTimestampError if TZDate.tz returns invalid Date', () => {
      const spy = jest.spyOn(TZDate, 'tz').mockImplementation(() => {
        const d = new Date(NaN) as unknown as TZDate;
        Object.setPrototypeOf(d, TZDate.prototype);
        return d;
      });
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK')).toThrow(InvalidTimestampError);
      spy.mockRestore();
    });
  });
});

describe('convertLocalToUTCByZone', () => {
  it('converts London local time to UTC', () => {
    expect(convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toBe(
      '2025-05-02T13:30:00Z'
    );
  });

  it('accepts leap day dates', () => {
    expect(convertLocalToUTCByZone('2024-02-29T12:00:00', 'Europe/London')).toBe(
      '2024-02-29T12:00:00Z'
    );
  });

  it('throws UnknownTimezoneError for invalid tz', () => {
    expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Not/A_Zone')).toThrow(
      UnknownTimezoneError
    );
  });

  it('caches invalid timezone results', () => {
    expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Not/A_Zone')).toThrow(
      UnknownTimezoneError
    );
    expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Not/A_Zone')).toThrow(
      UnknownTimezoneError
    );
  });

  it('throws InvalidTimestampError for malformed timestamp', () => {
    expect(() => convertLocalToUTCByZone('bad-format', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
  });

  it('throws InvalidTimestampError for invalid date components', () => {
    expect(() => convertLocalToUTCByZone('2025-13-02T14:30:00', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
    expect(() => convertLocalToUTCByZone('2025-02-30T14:30:00', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
    expect(() => convertLocalToUTCByZone('2025-05-02T24:30:00', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
  });

  it('throws InvalidTimestampError for fractional seconds format', () => {
    expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00.123', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
  });

  describe('error branches', () => {
    it('throws UnknownTimezoneError if TZDate.tz throws for valid zone', () => {
      const spy = jest.spyOn(TZDate, 'tz').mockImplementation(() => {
        throw new RangeError('forced');
      });
      expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toThrow(
        UnknownTimezoneError
      );
      spy.mockRestore();
    });

    it('throws InvalidTimestampError if TZDate.tz returns invalid Date', () => {
      const spy = jest.spyOn(TZDate, 'tz').mockImplementation(() => {
        const d = new Date(NaN) as unknown as TZDate;
        Object.setPrototypeOf(d, TZDate.prototype);
        return d;
      });
      expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toThrow(
        InvalidTimestampError
      );
      spy.mockRestore();
    });
  });
});
