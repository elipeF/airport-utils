import { execFileSync } from 'child_process';
import path from 'path';
import type * as AirportUtils from '../src/index';

// Test CommonJS build
describe('CommonJS build (dist/cjs)', () => {
  let cjs: typeof AirportUtils;

  beforeAll(() => {
    cjs = require('../dist/cjs/index.cjs') as typeof AirportUtils;
  });

  it('convertToUTC works in CommonJS build', () => {
    expect(cjs.convertToUTC('2025-05-02T14:30', 'JFK')).toBe('2025-05-02T18:30:00Z');
  });

  it('convertLocalToUTCByZone works in CommonJS build', () => {
    expect(cjs.convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toBe(
      '2025-05-02T13:30:00Z'
    );
  });

  it('getAirportInfo works in CommonJS build', () => {
    const info = cjs.getAirportInfo('JFK');
    expect(info).toHaveProperty('timezone');
    expect(info).toHaveProperty('latitude');
    expect(info).toHaveProperty('longitude');
  });

  it('exposes a lightweight CommonJS converter subpath', () => {
    const script = `
      const converter = require('airport-utils/converter');
      const geoLoaded = Object.keys(require.cache).some(path => path.includes('/mapping/geo.cjs'));
      console.log(JSON.stringify({
        result: converter.convertToUTC('2025-05-02T14:30', 'JFK'),
        geoLoaded
      }));
    `;
    const result = JSON.parse(
      execFileSync(process.execPath, ['--eval', script], { encoding: 'utf8' }).trim()
    );
    expect(result).toEqual({ result: '2025-05-02T18:30:00Z', geoLoaded: false });
  });
});

// Test ESM build using a subprocess to dynamically import the file
describe('ESM build (dist/esm)', () => {
  const esmPath = path.resolve(__dirname, '../dist/esm/index.js');
  const fileUrl = 'file://' + esmPath;

  it('convertToUTC works in ESM build', () => {
    const script = `const m = await import('${fileUrl}'); console.log(m.convertToUTC('2025-05-02T14:30','JFK'));`;
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8'
    }).trim();
    expect(result).toBe('2025-05-02T18:30:00Z');
  });

  it('convertLocalToUTCByZone works in ESM build', () => {
    const script = `const m = await import('${fileUrl}'); console.log(m.convertLocalToUTCByZone('2025-05-02T14:30:00','Europe/London'));`;
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8'
    }).trim();
    expect(result).toBe('2025-05-02T13:30:00Z');
  });

  it('getAirportInfo works in ESM build', () => {
    const script = `const m = await import('${fileUrl}'); console.log(JSON.stringify(m.getAirportInfo('JFK')));`;
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8'
    }).trim();
    const info = JSON.parse(result);
    expect(info).toHaveProperty('timezone');
    expect(info).toHaveProperty('latitude');
    expect(info).toHaveProperty('longitude');
  });

  it('exposes an ESM converter subpath', () => {
    const script = `
      const converter = await import('airport-utils/converter');
      console.log(converter.convertToUTC('2025-05-02T14:30', 'JFK'));
    `;
    const result = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8'
    }).trim();
    expect(result).toBe('2025-05-02T18:30:00Z');
  });
});
