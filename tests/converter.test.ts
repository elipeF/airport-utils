import * as dateFnsTz from '@date-fns/tz';
import { convertToUTC, convertLocalToUTCByZone } from '../src/converter';
import { UnknownAirportError, InvalidTimestampError, UnknownTimezoneError } from '../src/errors';
import { getInvalidIata } from './helpers';

const realDateFnsTz = jest.requireActual('@date-fns/tz') as typeof dateFnsTz;

jest.mock('@date-fns/tz', () => {
  const actual = jest.requireActual('@date-fns/tz') as typeof dateFnsTz;
  return {
    ...actual,
    tzOffset: jest.fn(actual.tzOffset),
    tzScan: jest.fn(actual.tzScan)
  };
});

const invalidIata = getInvalidIata();
const tzOffsetMock = dateFnsTz.tzOffset as jest.MockedFunction<typeof dateFnsTz.tzOffset>;

describe('convertToUTC', () => {
  beforeEach(() => {
    tzOffsetMock.mockReset();
    tzOffsetMock.mockImplementation(realDateFnsTz.tzOffset);
  });

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
    it('throws InvalidTimestampError if tzOffset throws', () => {
      tzOffsetMock.mockImplementation(() => {
        throw new Error('forced');
      });
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK')).toThrow(InvalidTimestampError);
    });

    it('throws InvalidTimestampError if tzOffset returns NaN', () => {
      tzOffsetMock.mockReturnValue(NaN);
      expect(() => convertToUTC('2025-05-02T14:30', 'JFK')).toThrow(InvalidTimestampError);
    });

    it('returns the last UTC candidate if offset solving does not converge within the loop budget', () => {
      tzOffsetMock
        .mockReturnValueOnce(60)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(60)
        .mockReturnValueOnce(0);
      expect(convertToUTC('2025-05-02T14:30', 'JFK')).toBe('2025-05-02T14:30:00Z');
    });
  });
});

describe('convertLocalToUTCByZone', () => {
  beforeEach(() => {
    tzOffsetMock.mockReset();
    tzOffsetMock.mockImplementation(realDateFnsTz.tzOffset);
  });

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

  it('rejects nonexistent local times during DST spring-forward transitions', () => {
    expect(() => convertLocalToUTCByZone('2025-03-09T02:30:00', 'America/New_York')).toThrow(
      InvalidTimestampError
    );
    expect(() => convertLocalToUTCByZone('2025-03-30T01:30:00', 'Europe/London')).toThrow(
      InvalidTimestampError
    );
  });

  it('accepts valid local times immediately after DST spring-forward transitions', () => {
    expect(convertLocalToUTCByZone('2025-03-09T03:30:00', 'America/New_York')).toBe(
      '2025-03-09T07:30:00Z'
    );
  });

  it('rejects ambiguous local times during DST fall-back transitions', () => {
    expect(() => convertLocalToUTCByZone('2025-11-02T01:30:00', 'America/New_York')).toThrow(
      InvalidTimestampError
    );
  });

  it('accepts unambiguous local times after DST fall-back transitions', () => {
    expect(convertLocalToUTCByZone('2025-11-02T03:30:00', 'America/New_York')).toBe(
      '2025-11-02T08:30:00Z'
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
    it('throws UnknownTimezoneError if tzOffset throws for valid zone', () => {
      tzOffsetMock.mockImplementation(() => {
        throw new RangeError('forced');
      });
      expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toThrow(
        UnknownTimezoneError
      );
    });

    it('throws UnknownTimezoneError if tzOffset returns NaN for valid zone', () => {
      tzOffsetMock.mockReturnValue(NaN);
      expect(() => convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toThrow(
        UnknownTimezoneError
      );
    });
  });
});

describe('convertToUTC DST handling', () => {
  it('rejects nonexistent local airport times during DST spring-forward transitions', () => {
    expect(() => convertToUTC('2025-03-09T02:30', 'JFK')).toThrow(InvalidTimestampError);
    expect(() => convertToUTC('2025-03-30T01:30', 'LHR')).toThrow(InvalidTimestampError);
  });

  it('rejects ambiguous local airport times during DST fall-back transitions', () => {
    expect(() => convertToUTC('2025-11-02T01:30', 'JFK')).toThrow(InvalidTimestampError);
  });
});
