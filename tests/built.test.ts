import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type * as AirportUtils from '../src/index';

function ensureBuild(): void {
  const esmPath = path.resolve(__dirname, '../dist/esm/index.js');
  const cjsPath = path.resolve(__dirname, '../dist/cjs/index.js');
  if (fs.existsSync(esmPath) && fs.existsSync(cjsPath)) return;
  execSync('npm run build', { stdio: 'inherit' });
}

// Test CommonJS build
describe('CommonJS build (dist/cjs)', () => {
  beforeAll(() => {
    ensureBuild();
  });

  const cjs = require('../dist/cjs/index.js') as typeof AirportUtils;
  const { convertToUTC, convertLocalToUTCByZone, getAirportInfo } = cjs;

  it('convertToUTC works in CommonJS build', () => {
    expect(convertToUTC('2025-05-02T14:30', 'JFK')).toBe('2025-05-02T18:30:00Z');
  });

  it('convertLocalToUTCByZone works in CommonJS build', () => {
    expect(convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London')).toBe(
      '2025-05-02T13:30:00Z'
    );
  });

  it('getAirportInfo works in CommonJS build', () => {
    const info = getAirportInfo('JFK');
    expect(info).toHaveProperty('timezone');
    expect(info).toHaveProperty('latitude');
    expect(info).toHaveProperty('longitude');
  });
});

// Test ESM build using a subprocess to dynamically import the file
describe('ESM build (dist/esm)', () => {
  beforeAll(() => {
    ensureBuild();
  });

  const esmPath = path.resolve(__dirname, '../dist/esm/index.js');
  const fileUrl = 'file://' + esmPath;

  it('convertToUTC works in ESM build', () => {
    const cmd = `node -e "(async()=>{ const m = await import('${fileUrl}'); console.log(m.convertToUTC('2025-05-02T14:30','JFK')); })()"`;
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    expect(result).toBe('2025-05-02T18:30:00Z');
  });

  it('convertLocalToUTCByZone works in ESM build', () => {
    const cmd = `node -e "(async()=>{ const m = await import('${fileUrl}'); console.log(m.convertLocalToUTCByZone('2025-05-02T14:30:00','Europe/London')); })()"`;
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    expect(result).toBe('2025-05-02T13:30:00Z');
  });

  it('getAirportInfo works in ESM build', () => {
    const cmd = `node -e "(async()=>{ const m = await import('${fileUrl}'); console.log(JSON.stringify(m.getAirportInfo('JFK'))); })()"`;
    const result = execSync(cmd, { encoding: 'utf-8' }).trim();
    const info = JSON.parse(result);
    expect(info).toHaveProperty('timezone');
    expect(info).toHaveProperty('latitude');
    expect(info).toHaveProperty('longitude');
  });
});
