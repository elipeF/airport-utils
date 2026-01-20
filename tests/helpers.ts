import { timezones } from '../src/mapping/timezones';

// Dynamically find an invalid 3-letter IATA code not in the mapping.
export function getInvalidIata(): string {
  const existing = new Set(Object.keys(timezones));
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      for (let c = 65; c <= 90; c++) {
        const code = String.fromCharCode(a, b, c);
        if (!existing.has(code)) return code;
      }
    }
  }
  /* istanbul ignore next */
  throw new Error('All codes taken?!');
}
