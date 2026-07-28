#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { format } from 'oxfmt';
import { geo as currentGeo } from '#mapping/geo';
import { timezones as currentTimezones } from '#mapping/timezones';

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_por_public.csv';
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_MAPPING_ENTRIES = 8_000;
const MAX_ENTRY_DROP_RATIO = 0.02;
const REQUIRED_AIRPORTS = ['JFK', 'LHR', 'HND', 'SYD'] as const;

interface GenerateMappingOptions {
  cwd?: string;
  enforceQualityGates?: boolean;
  fetchImpl?: typeof globalThis.fetch;
  sourceUrl?: string;
  timeoutMs?: number;
}

function pickCity(cityNameList: string): string {
  const parts = cityNameList
    .split(/[=,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? '';
}

export function assertMappingQuality(
  timezonesMap: Record<string, string>,
  geoMap: Record<string, unknown>
): void {
  const timezoneCount = Object.keys(timezonesMap).length;
  const geoCount = Object.keys(geoMap).length;
  if (timezoneCount < MIN_MAPPING_ENTRIES) {
    throw new Error(
      `Mapping quality gate failed: expected at least ${MIN_MAPPING_ENTRIES} timezone entries, got ${timezoneCount}`
    );
  }
  if (geoCount < MIN_MAPPING_ENTRIES) {
    throw new Error(
      `Mapping quality gate failed: expected at least ${MIN_MAPPING_ENTRIES} geo entries, got ${geoCount}`
    );
  }

  const minimumTimezoneCount = Math.floor(
    Object.keys(currentTimezones).length * (1 - MAX_ENTRY_DROP_RATIO)
  );
  const minimumGeoCount = Math.floor(Object.keys(currentGeo).length * (1 - MAX_ENTRY_DROP_RATIO));
  if (timezoneCount < minimumTimezoneCount) {
    throw new Error(
      `Mapping quality gate failed: timezone count dropped by more than ${MAX_ENTRY_DROP_RATIO * 100}%`
    );
  }
  if (geoCount < minimumGeoCount) {
    throw new Error(
      `Mapping quality gate failed: geo count dropped by more than ${MAX_ENTRY_DROP_RATIO * 100}%`
    );
  }

  for (const iata of REQUIRED_AIRPORTS) {
    if (!timezonesMap[iata]) {
      throw new Error(`Mapping quality gate failed: missing timezone for ${iata}`);
    }
    if (!geoMap[iata]) {
      throw new Error(`Mapping quality gate failed: missing geo entry for ${iata}`);
    }
  }
}

export async function generateMapping(options: GenerateMappingOptions = {}) {
  const {
    cwd = process.cwd(),
    enforceQualityGates = true,
    fetchImpl = globalThis.fetch,
    sourceUrl = DEFAULT_SOURCE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;
  const resolvedFetch = fetchImpl;
  if (!resolvedFetch) {
    throw new Error('Global fetch is not available.');
  }

  const res = await resolvedFetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText ?? 'Unknown error'}`);
  const text = await res.text();
  const sourceHash = createHash('sha256').update(text).digest('hex');

  const lines = text.split('\n').filter((l) => l.trim());
  const header = lines[0]?.split('^') ?? [];
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
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('^');
    const code = cols[idx.iata];
    if (!code || !/^[A-Z]{3}$/.test(code)) continue;
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
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      name &&
      city &&
      country &&
      countryName &&
      continent
    ) {
      geoMap[code] = { latitude: lat, longitude: lon, name, city, country, countryName, continent };
    }
  }

  // Object.keys returns a fresh array, so sorting in place avoids an unnecessary copy.
  // oxlint-disable-next-line unicorn/no-array-sort
  const sortedCodes = Object.keys(timezonesMap).sort();
  const sortedTz = Object.fromEntries(sortedCodes.map((c) => [c, timezonesMap[c]]));
  const sortedGeo = Object.fromEntries(
    sortedCodes.filter((c) => geoMap[c]).map((c) => [c, geoMap[c]])
  );
  if (enforceQualityGates) {
    assertMappingQuality(sortedTz, sortedGeo);
  }

  const dir = path.resolve(cwd, 'src/mapping');
  fs.mkdirSync(dir, { recursive: true });

  // Write TypeScript modules
  const tzTs = [
    '// generated — do not edit',
    `// Source: ${sourceUrl}`,
    `// Source SHA-256: ${sourceHash}`,
    '// Filtered and transformed from Open Travel Data (OPTD); see NOTICE.',
    'export const timezones: Record<string, string> = ',
    JSON.stringify(sortedTz, null, 2) + ';'
  ].join('\n');
  const { code: formattedTz } = await format('timezones.ts', tzTs, {
    printWidth: 100,
    semi: true,
    singleQuote: true,
    trailingComma: 'none'
  });
  fs.writeFileSync(path.join(dir, 'timezones.ts'), formattedTz);

  const geoTs = [
    '// generated — do not edit',
    `// Source: ${sourceUrl}`,
    `// Source SHA-256: ${sourceHash}`,
    '// Filtered and transformed from Open Travel Data (OPTD); see NOTICE.',
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
  const { code: formattedGeo } = await format('geo.ts', geoTs, {
    printWidth: 100,
    semi: true,
    singleQuote: true,
    trailingComma: 'none'
  });
  fs.writeFileSync(path.join(dir, 'geo.ts'), formattedGeo);

  console.log(
    `✅ Mappings: ${sortedCodes.length} timezones, ${Object.keys(sortedGeo).length} geo entries`
  );
}
