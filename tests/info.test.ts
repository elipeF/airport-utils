import { getAirportInfo } from '../src/info';
import { UnknownAirportError } from '../src/errors';
import { timezones } from '../src/mapping/timezones';
import { geo } from '../src/mapping/geo';

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

describe('getAirportInfo', () => {
  const validCodes = Object.keys(timezones).filter(i => geo[i]);
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
    const { getAllAirports } = require('../src/info');
    const all = getAllAirports();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('iata');
    expect(all[0]).toHaveProperty('continent');
  });

  it('throws UnknownAirportError for missing IATA', () => {
    expect(() => getAirportInfo(invalidIata))
      .toThrow(UnknownAirportError);
  });
});
