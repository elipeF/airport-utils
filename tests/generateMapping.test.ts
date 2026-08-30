import type { Mock } from 'vitest';

const buildCsv = (rows: string[]) => {
  const header = [
    'iata_code',
    'timezone',
    'latitude',
    'longitude',
    'name',
    'city_name_list',
    'location_type',
    'country_code',
    'country_name',
    'continent_name'
  ].join('^');
  return [header, ...rows].join('\n');
};

const takeEntries = <T>(record: Record<string, T>, count: number) =>
  Object.fromEntries(Object.entries(record).slice(0, count));

const globalAny = globalThis as unknown as { fetch?: typeof globalThis.fetch };

vi.mock('fs', async () => {
  const realFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    __esModule: true,
    default: {
      ...realFs,
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn()
    }
  };
});

vi.mock('oxfmt', () => ({
  format: vi.fn(async (_filePath: string, text: string) => ({ code: text }))
}));

describe('generateMapping', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('writes mappings and normalizes city names', async () => {
    const csv = buildCsv([
      // Airport row should win and city should be the primary token from the source list
      'ACE^Atlantic/Canary^28.95027^-13.60556^Lanzarote Airport^Lanzarote=Arrecife^A^ES^Spain^Europe',
      // City rows should be ignored
      'ACE^Europe/Paris^28.96302^-13.54769^Arrecife^Lanzarote=Arrecife^C^ES^Spain^Europe',
      'AMS^Europe/Amsterdam^52.37403^4.88969^Amsterdam^Amsterdam=Schiphol^C^NL^Netherlands^Europe',
      'AMS^Europe/Amsterdam^52.3103^4.76028^Amsterdam Airport Schiphol^Amsterdam=Schiphol^A^NL^Netherlands^Europe',
      'JFK^America/New_York^40.63983^-73.77874^John F. Kennedy International Airport^New York City=Jamaica^A^US^United States^North America',
      'FOO^UTC^1^2^Comma Airport^Foo,Bar^A^XX^Nowhere^Asia',
      // Invalid code should be skipped
      'ZZ^UTC^0^0^Bad^Bad City^A^ZZ^Nowhere^Antarctica',
      // Missing timezone should not add to timezone map
      'NOT^^10^20^No Tz Airport^Foo,Bar^A^XX^Nowhere^Asia',
      // Invalid lat/lon should be skipped for geo
      'INV^UTC^^20^Invalid^Foo^A^XX^Nowhere^Asia',
      // Empty city list should fall back to empty city
      'EMP^UTC^1^2^Empty City^^A^XX^Nowhere^Asia',
      // Short row should yield undefined location_type
      'MIS^UTC^1^2^Missing Fields^City'
    ]);

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');
    const oxfmt = await import('oxfmt');

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping({ enforceQualityGates: false });

    expect(fs.default.mkdirSync as Mock).toHaveBeenCalled();
    expect(fs.default.writeFileSync as Mock).toHaveBeenCalledTimes(2);
    expect(oxfmt.format).toHaveBeenCalledWith(
      'timezones.ts',
      expect.any(String),
      expect.objectContaining({ singleQuote: true })
    );

    const geoWrite = (fs.default.writeFileSync as Mock).mock.calls.find(([file]) =>
      String(file).endsWith('geo.ts')
    );
    expect(geoWrite).toBeTruthy();
    const geoContents = String(geoWrite?.[1]);
    expect(geoContents).toContain('"city": "Lanzarote"');
    expect(geoContents).toContain('"city": "Amsterdam"');
    expect(geoContents).toContain('"city": "New York City"');
    expect(geoContents).toContain('"city": "Foo"');
    expect(geoContents).toContain('Source SHA-256:');
    expect(geoContents).not.toContain('Warszawa Centralna Railway Station');
  });

  it('throws when required columns are missing', async () => {
    const badCsv = ['iata_code^timezone^latitude'].join('\n');

    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => badCsv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Missing required OPTD columns');
  });

  it('throws when the source dataset is empty', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => ''
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Missing required OPTD columns');
  });

  it('uses global fetch when fetchImpl is not provided', async () => {
    const csv = buildCsv([
      'ACE^Atlantic/Canary^28.95027^-13.60556^Lanzarote Airport^Lanzarote=Arrecife^A^ES^Spain^Europe'
    ]);
    const globalFetch = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    const previousFetch = globalAny.fetch;
    globalAny.fetch = globalFetch;

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping({ enforceQualityGates: false });

    expect(globalFetch).toHaveBeenCalled();
    globalAny.fetch = previousFetch;
  });

  it('throws when global fetch is missing', async () => {
    const previousFetch = globalAny.fetch;
    delete globalAny.fetch;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Global fetch is not available.');

    globalAny.fetch = previousFetch;
  });

  it('throws when fetch response is not ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      statusText: 'Bad Gateway',
      text: async () => ''
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Fetch failed: Bad Gateway');
  });

  it('uses unknown error status text when the response omits it', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      text: async () => ''
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Fetch failed: Unknown error');
  });

  it('skips rows that are not airports', async () => {
    const csv = buildCsv([
      'CIT^UTC^1^2^City^City^C^XX^Nowhere^Asia',
      'BUS^UTC^3^4^Bus Station^City^B^XX^Nowhere^Asia',
      'AIR^UTC^5^6^Airport^City^A^XX^Nowhere^Asia',
      'NTZ^^7^8^No Tz Airport^City^A^XX^Nowhere^Asia',
      'NTZ^UTC^7^8^No Tz Airport^City^A^XX^Nowhere^Asia'
    ]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping({ enforceQualityGates: false });

    const geoWrite = (fs.default.writeFileSync as Mock).mock.calls.find(([file]) =>
      String(file).endsWith('geo.ts')
    );
    expect(geoWrite).toBeTruthy();
    const geoContents = String(geoWrite?.[1]);
    expect(geoContents).toContain('"AIR"');
    expect(geoContents).toContain('"NTZ"');
    expect(geoContents).not.toContain('"CIT"');
    expect(geoContents).not.toContain('"BUS"');
  });

  it('uses default cwd/sourceUrl when omitted', async () => {
    const csv = buildCsv(['DEF^UTC^1^2^Default Airport^Default City^A^XX^Nowhere^Asia']);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const previousCwd = process.cwd();
    const tempDir = fs.default.mkdtempSync(path.join(os.tmpdir(), 'airport-utils-'));
    process.chdir(tempDir);

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping({ enforceQualityGates: false });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_por_public.csv',
      { signal: expect.any(AbortSignal) }
    );

    process.chdir(previousCwd);
  });

  it('rejects unexpectedly small mapping datasets', async () => {
    const csv = buildCsv([
      'JFK^America/New_York^40.63983^-73.77874^John F. Kennedy International Airport^New York City^A^US^United States^North America'
    ]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Mapping quality gate failed');
  });

  it('enforces entry counts, drop limits, and required airports', async () => {
    const { assertMappingQuality } = await import('../scripts/generateMapping');
    const { timezones } = await import('../src/mapping/timezones');
    const { geo } = await import('../src/mapping/geo');

    expect(() => assertMappingQuality(timezones, geo)).not.toThrow();
    expect(() => assertMappingQuality({}, geo)).toThrow('timezone entries');
    expect(() => assertMappingQuality(timezones, {})).toThrow('geo entries');
    expect(() => assertMappingQuality(takeEntries(timezones, 8_100), geo)).toThrow(
      'timezone count dropped'
    );
    expect(() => assertMappingQuality(timezones, takeEntries(geo, 8_100))).toThrow(
      'geo count dropped'
    );

    const timezonesWithoutJfk = { ...timezones };
    delete timezonesWithoutJfk.JFK;
    expect(() => assertMappingQuality(timezonesWithoutJfk, geo)).toThrow(
      'missing timezone for JFK'
    );

    const geoWithoutJfk = { ...geo };
    delete geoWithoutJfk.JFK;
    expect(() => assertMappingQuality(timezones, geoWithoutJfk)).toThrow(
      'missing geo entry for JFK'
    );
  });

  it('does not rewrite mappings when only the source hash changes', async () => {
    const timezones = { AAA: 'Pacific/Tahiti' };
    const geo = {
      AAA: {
        latitude: -17.352606,
        longitude: -145.509956,
        name: 'Anaa Airport',
        city: 'Anaa',
        country: 'PF',
        countryName: 'French Polynesia',
        continent: 'Oceania'
      }
    };
    vi.doMock('#mapping/timezones', () => ({ timezones }));
    vi.doMock('#mapping/geo', () => ({ geo }));

    const csv = buildCsv([
      'AAA^Pacific/Tahiti^-17.352606^-145.509956^Anaa Airport^Anaa^A^PF^French Polynesia^Oceania',
      // This ignored row changes the downloaded source and its hash, but not either mapping.
      'AAA^UTC^0^0^Anaa^Anaa^C^PF^French Polynesia^Oceania'
    ]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');
    const oxfmt = await import('oxfmt');
    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping({ enforceQualityGates: false });

    expect(oxfmt.format).not.toHaveBeenCalled();
    expect(fs.default.writeFileSync as Mock).not.toHaveBeenCalled();
  });
});
