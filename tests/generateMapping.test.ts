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

const globalAny = globalThis as unknown as { fetch?: typeof globalThis.fetch };

jest.mock('fs', () => {
  const realFs = jest.requireActual('fs');
  return {
    __esModule: true,
    default: {
      ...realFs,
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn()
    }
  };
});

jest.mock('prettier', () => ({
  __esModule: true,
  default: {
    resolveConfig: jest.fn(),
    format: jest.fn(async (text: string) => text)
  }
}));

describe('generateMapping', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('writes mappings and normalizes city names', async () => {
    const csv = buildCsv([
      // Airport row should win and city should be last token after "="
      'ACE^Atlantic/Canary^28.95027^-13.60556^Lanzarote Airport^Lanzarote=Arrecife^A^ES^Spain^Europe',
      // City rows should be ignored
      'ACE^Europe/Paris^28.96302^-13.54769^Arrecife^Lanzarote=Arrecife^C^ES^Spain^Europe',
      'AMS^Europe/Amsterdam^52.37403^4.88969^Amsterdam^Amsterdam=Schiphol^C^NL^Netherlands^Europe',
      'AMS^Europe/Amsterdam^52.3103^4.76028^Amsterdam Airport Schiphol^Amsterdam=Schiphol^A^NL^Netherlands^Europe',
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

    const fetchMock = jest.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');
    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping();

    expect((fs.default.mkdirSync as jest.Mock)).toHaveBeenCalled();
    expect((fs.default.writeFileSync as jest.Mock)).toHaveBeenCalledTimes(2);
    expect(prettier.default.resolveConfig).toHaveBeenCalledWith(expect.any(String), {
      editorconfig: true
    });
    expect(prettier.default.format).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ parser: 'typescript' })
    );

    const geoWrite = (fs.default.writeFileSync as jest.Mock).mock.calls.find(([file]) =>
      String(file).endsWith('geo.ts')
    );
    expect(geoWrite).toBeTruthy();
    const geoContents = String(geoWrite?.[1]);
    expect(geoContents).toContain('"city": "Arrecife"');
    expect(geoContents).toContain('"city": "Schiphol"');
    expect(geoContents).not.toContain('Warszawa Centralna Railway Station');
  });

  it('throws when required columns are missing', async () => {
    const badCsv = ['iata_code^timezone^latitude'].join('\n');

    const fetchMock = jest.fn(async () => ({
      ok: true,
      text: async () => badCsv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Missing required OPTD columns');
  });

  it('uses global fetch when fetchImpl is not provided', async () => {
    const csv = buildCsv([
      'ACE^Atlantic/Canary^28.95027^-13.60556^Lanzarote Airport^Lanzarote=Arrecife^A^ES^Spain^Europe'
    ]);
    const globalFetch = jest.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    const previousFetch = globalAny.fetch;
    globalAny.fetch = globalFetch;

    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping();

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
    const fetchMock = jest.fn(async () => ({
      ok: false,
      statusText: 'Bad Gateway',
      text: async () => ''
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const { generateMapping } = await import('../scripts/generateMapping');
    await expect(generateMapping()).rejects.toThrow('Fetch failed: Bad Gateway');
  });

  it('uses fallback config and unknown error status text', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      text: async () => ''
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue(null);

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
    const fetchMock = jest.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const fs = await import('fs');
    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping();

    const geoWrite = (fs.default.writeFileSync as jest.Mock).mock.calls.find(([file]) =>
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
    const fetchMock = jest.fn(async () => ({
      ok: true,
      text: async () => csv
    })) as unknown as typeof globalThis.fetch;
    globalAny.fetch = fetchMock;

    const prettier = await import('prettier');
    (prettier.default.resolveConfig as jest.Mock).mockResolvedValue({});

    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const previousCwd = process.cwd();
    const tempDir = fs.default.mkdtempSync(path.join(os.tmpdir(), 'airport-utils-'));
    process.chdir(tempDir);

    const { generateMapping } = await import('../scripts/generateMapping');
    await generateMapping();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_por_public.csv'
    );

    process.chdir(previousCwd);
  });
});
