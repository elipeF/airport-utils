import { getAirportInfo, getAllAirports } from '../src/info';
import { UnknownAirportError } from '../src/errors';
import { timezones } from '../src/mapping/timezones';
import { geo } from '../src/mapping/geo';
import { getInvalidIata } from './helpers';

const invalidIata = getInvalidIata();

describe('getAirportInfo', () => {
  const validCodes = Object.keys(timezones).filter((i) => geo[i]);
  const sample = validCodes.length > 0 ? validCodes[0] : 'JFK';

  it('returns full info for a valid IATA', () => {
    const info = getAirportInfo(sample);
    expect(info).toEqual({
      timezone: timezones[sample],
      ...geo[sample]
    });
    expect(info.continent).toBeDefined();
    expect(info.countryName).toBeDefined();
  });

  it('returns all airports', () => {
    const all = getAllAirports();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('iata');
    expect(all[0]).toHaveProperty('continent');
  });

  it('throws UnknownAirportError for missing IATA', () => {
    expect(() => getAirportInfo(invalidIata)).toThrow(UnknownAirportError);
  });
});
