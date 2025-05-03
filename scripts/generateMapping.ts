#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function generateMapping() {
  const url =
    'https://raw.githubusercontent.com/opentraveldata/opentraveldata/master/opentraveldata/optd_por_public.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  const text = await res.text();

  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0].split('^');
  const idx = {
    iata: header.indexOf('iata_code'),
    tz: header.indexOf('timezone'),
    lat: header.indexOf('latitude'),
    lon: header.indexOf('longitude'),
    name: header.indexOf('name'),
    city: header.indexOf('city_name_list'),
    country: header.indexOf('country_code')
  };
  if (Object.values(idx).some(i => i < 0)) {
    throw new Error('Missing required OPTD columns');
  }

  const timezonesMap: Record<string, string> = {};
  const geoMap: Record<string, {
    latitude: number;
    longitude: number;
    name: string;
    city: string;
    country: string;
  }> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('^');
    const code = cols[idx.iata];
    if (!code || code.length !== 3) continue;
    const tz = cols[idx.tz];
    if (tz) timezonesMap[code] = tz;

    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    const name = cols[idx.name];
    const city = cols[idx.city].split(',')[0].trim();
    const country = cols[idx.country];
    if (!isNaN(lat) && !isNaN(lon) && name && city && country) {
      geoMap[code] = { latitude: lat, longitude: lon, name, city, country };
    }
  }

  const sortedCodes = Object.keys(timezonesMap).sort();
  const sortedTz = Object.fromEntries(sortedCodes.map(c => [c, timezonesMap[c]]));
  const sortedGeo = Object.fromEntries(
    sortedCodes.filter(c => geoMap[c]).map(c => [c, geoMap[c]])
  );

  const dir = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/mapping');
  fs.mkdirSync(dir, { recursive: true });

  // Write TypeScript modules
  const tzTs = [
    '// generated — do not edit',
    'export const timezones: Record<string, string> = ',
    JSON.stringify(sortedTz, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'timezones.ts'), tzTs + '\n');

  const geoEntries = Object.entries(sortedGeo)
    .map(([code, g]) => `  "${code}": ${JSON.stringify(g)}`)
    .join(',\n');
  const geoTs = [
    '// generated — do not edit',
    'export interface GeoEntry {',
    '  latitude: number;',
    '  longitude: number;',
    '  name: string;', 
    '  city: string;',
    '  country: string;',
    '}', '',
    'export const geo: Record<string, GeoEntry> = {',
    geoEntries,
    '};',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'geo.ts'), geoTs + '\n');

  console.log(`✅ Mappings: ${sortedCodes.length} timezones, ${Object.keys(sortedGeo).length} geo entries`);
}

generateMapping().catch(err => {
  console.error(err);
  process.exit(1);
});