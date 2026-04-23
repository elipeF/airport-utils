import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const packagePath = path.resolve(repoRoot, 'dist/cjs/index.cjs');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output') args.output = argv[++i];
    if (argv[i] === '--label') args.label = argv[++i];
  }
  return args;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function benchmark(label, iterations, fn) {
  for (let i = 0; i < Math.min(iterations, 200); i++) fn(i);
  const startedAt = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsedMs = performance.now() - startedAt;
  return {
    label,
    iterations,
    totalMs: round(elapsedMs, 2),
    usPerCall: round((elapsedMs * 1000) / iterations)
  };
}

function measureColdLoad(iterations = 5) {
  const loadTimesMs = [];
  const heapDeltasMb = [];

  const code = `
    const { performance } = require('node:perf_hooks');
    const before = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    require(${JSON.stringify(packagePath)});
    const elapsedMs = performance.now() - startedAt;
    const after = process.memoryUsage().heapUsed;
    console.log(JSON.stringify({
      loadMs: elapsedMs,
      heapDeltaMb: (after - before) / 1024 / 1024
    }));
  `;

  for (let i = 0; i < iterations; i++) {
    const raw = execFileSync(process.execPath, ['-e', code], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    const parsed = JSON.parse(raw);
    loadTimesMs.push(parsed.loadMs);
    heapDeltasMb.push(parsed.heapDeltaMb);
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    iterations,
    averageLoadMs: round(average(loadTimesMs)),
    averageHeapDeltaMb: round(average(heapDeltasMb), 2),
    samples: {
      loadMs: loadTimesMs.map((value) => round(value)),
      heapDeltaMb: heapDeltasMb.map((value) => round(value, 2))
    }
  };
}

const { convertToUTC, convertLocalToUTCByZone, getAirportInfo, getAllAirports } = await import(
  pathToFileUrl(packagePath)
);

function pathToFileUrl(targetPath) {
  return new URL(`file://${targetPath}`);
}

const sameAirportCases = Array.from({ length: 20_000 }, (_, index) => ({
  localIso: `2025-05-${String((index % 28) + 1).padStart(2, '0')}T14:${String(index % 60).padStart(2, '0')}`,
  iata: 'JFK'
}));

const mixedAirportCases = [
  ['JFK', '2025-05-02T14:30'],
  ['LHR', '2025-05-02T14:30'],
  ['NRT', '2025-05-02T14:30'],
  ['SYD', '2025-05-02T14:30'],
  ['DXB', '2025-05-02T14:30'],
  ['SFO', '2025-05-02T14:30'],
  ['HND', '2025-05-02T14:30'],
  ['CDG', '2025-05-02T14:30']
];

const sameZoneCases = Array.from({ length: 20_000 }, (_, index) => ({
  localIso: `2025-05-${String((index % 28) + 1).padStart(2, '0')}T14:${String(index % 60).padStart(2, '0')}:00`,
  timeZone: 'Europe/London'
}));

const mixedZoneCases = [
  ['Europe/London', '2025-05-02T14:30:00'],
  ['America/New_York', '2025-05-02T14:30:00'],
  ['Asia/Tokyo', '2025-05-02T14:30:00'],
  ['Australia/Sydney', '2025-05-02T14:30:00'],
  ['Europe/Berlin', '2025-05-02T14:30:00'],
  ['UTC', '2025-05-02T14:30:00']
];

const results = {
  label: parseArgs(process.argv.slice(2)).label ?? 'run',
  generatedAt: new Date().toISOString(),
  node: process.version,
  coldLoad: measureColdLoad(),
  benchmarks: {
    getAirportInfo: benchmark('getAirportInfo', 250_000, () => {
      getAirportInfo('JFK');
    }),
    convertToUTC_singleAirport: benchmark('convertToUTC_singleAirport', sameAirportCases.length, (index) => {
      const item = sameAirportCases[index];
      convertToUTC(item.localIso, item.iata);
    }),
    convertToUTC_mixedAirports: benchmark(
      'convertToUTC_mixedAirports',
      50_000,
      (index) => {
        const item = mixedAirportCases[index % mixedAirportCases.length];
        convertToUTC(item[1], item[0]);
      }
    ),
    convertLocalToUTCByZone_singleZone: benchmark(
      'convertLocalToUTCByZone_singleZone',
      sameZoneCases.length,
      (index) => {
        const item = sameZoneCases[index];
        convertLocalToUTCByZone(item.localIso, item.timeZone);
      }
    ),
    convertLocalToUTCByZone_mixedZones: benchmark(
      'convertLocalToUTCByZone_mixedZones',
      50_000,
      (index) => {
        const item = mixedZoneCases[index % mixedZoneCases.length];
        convertLocalToUTCByZone(item[1], item[0]);
      }
    ),
    getAllAirports: benchmark('getAllAirports', 100, () => {
      getAllAirports();
    })
  }
};

const args = parseArgs(process.argv.slice(2));
if (args.output) {
  const outputPath = path.resolve(repoRoot, args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify(results, null, 2));
