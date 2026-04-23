import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatPercent(before, after) {
  return round(((before - after) / before) * 100);
}

const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
if (!beforeArg || !afterArg || !outputArg) {
  throw new Error('Usage: node benchmarks/compare-results.mjs <before.json> <after.json> <output.md>');
}

const before = JSON.parse(await fs.readFile(path.resolve(beforeArg), 'utf8'));
const after = JSON.parse(await fs.readFile(path.resolve(afterArg), 'utf8'));

const metrics = [
  ['coldLoad.averageLoadMs', 'Cold load (ms)'],
  ['coldLoad.averageHeapDeltaMb', 'Cold load heap delta (MB)'],
  ['benchmarks.getAirportInfo.usPerCall', 'getAirportInfo (us/call)'],
  ['benchmarks.convertToUTC_singleAirport.usPerCall', 'convertToUTC single airport (us/call)'],
  ['benchmarks.convertToUTC_mixedAirports.usPerCall', 'convertToUTC mixed airports (us/call)'],
  ['benchmarks.convertLocalToUTCByZone_singleZone.usPerCall', 'convertLocalToUTCByZone single zone (us/call)'],
  ['benchmarks.convertLocalToUTCByZone_mixedZones.usPerCall', 'convertLocalToUTCByZone mixed zones (us/call)'],
  ['benchmarks.getAllAirports.usPerCall', 'getAllAirports (us/call)']
];

function getValue(object, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current[key], object);
}

const lines = ['# Exported Library Benchmark Comparison', '', '| Metric | Before | After | Gain |', '| --- | ---: | ---: | ---: |'];

for (const [metricPath, label] of metrics) {
  const beforeValue = getValue(before, metricPath);
  const afterValue = getValue(after, metricPath);
  const gain = formatPercent(beforeValue, afterValue);
  lines.push(`| ${label} | ${beforeValue} | ${afterValue} | ${gain}% |`);
}

await fs.mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
await fs.writeFile(path.resolve(outputArg), lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
