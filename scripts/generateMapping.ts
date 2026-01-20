#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import prettier from 'prettier';

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_por_public.csv';

export async function generateMapping() {
  const resolvedFetch = globalThis.fetch;
  if (!resolvedFetch) {
    throw new Error('Global fetch is not available.');
  }
  const cwd = process.cwd();

  const prettierConfig =
    (await prettier.resolveConfig(path.join(cwd, 'package.json'), {
      editorconfig: true
    })) ?? {};

  const res = await resolvedFetch(DEFAULT_SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText ?? 'Unknown error'}`);
  const text = await res.text();

  const lines = text.split('\n').filter((l) => l.trim());
  const header = lines[0].split('^');
  const idx = {
    iata: header.indexOf('iata_code'),
    tz: header.indexOf('timezone'),
    lat: header.indexOf('latitude'),
    lon: header.indexOf('longitude'),
    name: header.indexOf('name'),
    city: header.indexOf('city_name_list'),
    locationType: header.indexOf('location_type'),
    country: header.indexOf('country_code'),
    countryName: header.indexOf('country_name'),
    continent: header.indexOf('continent_name')
  };
  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error('Missing required OPTD columns');
  }

  const timezonesMap: Record<string, string> = {};
  const geoMap: Record<
    string,
    {
      latitude: number;
      longitude: number;
      name: string;
      city: string;
      country: string;
      countryName: string;
      continent: string;
    }
  > = {};
  const pickCity = (cityNameList: string) => {
    const parts = cityNameList
      .split(/[=,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.at(-1) ?? '';
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('^');
    const code = cols[idx.iata];
    if (!code || code.length !== 3) continue;
    const locationType = cols[idx.locationType] ?? '';
    if (locationType !== 'A') continue;
    const tz = cols[idx.tz];
    if (tz) {
      timezonesMap[code] = tz;
    }

    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    const name = cols[idx.name];
    const city = pickCity(cols[idx.city]);
    const country = cols[idx.country];
    const countryName = cols[idx.countryName];
    const continent = cols[idx.continent];
    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      name &&
      city &&
      country &&
      countryName &&
      continent
    ) {
      geoMap[code] = { latitude: lat, longitude: lon, name, city, country, countryName, continent };
    }
  }

  const sortedCodes = Object.keys(timezonesMap).sort();
  const sortedTz = Object.fromEntries(sortedCodes.map((c) => [c, timezonesMap[c]]));
  const sortedGeo = Object.fromEntries(
    sortedCodes.filter((c) => geoMap[c]).map((c) => [c, geoMap[c]])
  );

  const dir = path.resolve(cwd, 'src/mapping');
  fs.mkdirSync(dir, { recursive: true });

  // Write TypeScript modules
  const tzTs = [
    '// generated — do not edit',
    'export const timezones: Record<string, string> = ',
    JSON.stringify(sortedTz, null, 2) + ';'
  ].join('\n');
  const formattedTz = await prettier.format(tzTs, {
    ...prettierConfig,
    parser: 'typescript'
  });
  fs.writeFileSync(path.join(dir, 'timezones.ts'), formattedTz);

  const geoTs = [
    '// generated — do not edit',
    'export interface GeoEntry {',
    '  latitude: number;',
    '  longitude: number;',
    '  name: string;',
    '  city: string;',
    '  country: string;',
    '  countryName: string;',
    '  continent: string;',
    '}',
    '',
    'export const geo: Record<string, GeoEntry> = ',
    JSON.stringify(sortedGeo, null, 2) + ';'
  ].join('\n');
  const formattedGeo = await prettier.format(geoTs, {
    ...prettierConfig,
    parser: 'typescript'
  });
  fs.writeFileSync(path.join(dir, 'geo.ts'), formattedGeo);

  console.log(
    `✅ Mappings: ${sortedCodes.length} timezones, ${Object.keys(sortedGeo).length} geo entries`
  );
}
