# airport-utils

Convert local ISO 8601 timestamps to UTC using airport IATA codes, with airport geo-data.

## Features

- **Local → UTC** conversion only (ISO 8601 in, ISO 8601 UTC out)
- Built-in IATA→IANA timezone mapping (OPTD)
- Built-in airport geo-data: latitude, longitude, name, city, country
- TypeScript support, Node 20+
- Synchronous API with custom error classes
- Day.js (UTC & Timezone plugins) under the hood
- Daily auto-updated mapping via GitHub Actions
- Jest tests with 100% coverage
- Automated releases via semantic-release

## Installation

```bash
npm install airport-utils
```

## Usage

```ts
import {
  convertToUTC,
  convertLocalToUTCByZone,
  getAirportInfo,
  UnknownAirportError,
  InvalidTimestampError,
  UnknownTimezoneError
} from 'airport-utils';

// Convert local time to UTC
try {
  const utc = convertToUTC('2025-05-02T14:30', 'JFK');
  console.log(utc); // "2025-05-02T18:30:00Z"
} catch (err) {
  // handle UnknownAirportError or InvalidTimestampError
}

// Convert local time by zone
try {
  const utc2 = convertLocalToUTCByZone('2025-05-02T14:30:00', 'Europe/London');
  console.log(utc2); // "2025-05-02T13:30:00Z"
} catch (err) {
  // handle UnknownTimezoneError or InvalidTimestampError
}

// Get full airport info
try {
  const info = getAirportInfo('JFK');
  console.log(info);
  // {
  //   timezone: 'America/New_York',
  //   latitude: 40.6413,
  //   longitude: -73.7781,
  //   name: 'John F. Kennedy International Airport',
  //   city: 'New York',
  //   country: 'US',
  //   continent: 'North America'
  // }
} catch (err) {
  // handle UnknownAirportError
}

// Get all airports
import { getAllAirports } from 'airport-utils';
const airports = getAllAirports();
console.log(airports.length); // > 10000
```

### API

```ts
export function convertToUTC(
  localIso: string,
  iata: string
): string;

export function convertLocalToUTCByZone(
  localIso: string,
  timeZone: string
): string;

export function getAirportInfo(iata: string): {
  timezone: string;
  latitude: number;
  longitude: number;
  name: string;
  city: string;
  country: string;
  continent: string;
};

export function getAllAirports(): {
  iata: string;
  timezone: string;
  latitude: number;
  longitude: number;
  name: string;
  city: string;
  country: string;
  continent: string;
}[];

export class UnknownAirportError extends Error {}
export class InvalidTimestampError extends Error {}
export class UnknownTimezoneError extends Error {}
```

## Updating Mappings

```bash
npm run update:mapping
```

Runs `scripts/generateMapping.ts` to fetch OPTD CSV and regenerate:
- `src/mapping/timezones.ts`
- `src/mapping/geo.ts`

## Development

```bash
npm ci
npm run build
npm test
npm run update:mapping
```

## CI & Release

- **ci.yml**: build & test on push/PR
- **update-mapping.yml**: daily at 00:00 UTC, updates mapping, builds & tests, auto-commit
- **publish.yml**: daily at 02:00 UTC, builds, tests, and runs semantic-release
- Semantic-release uses default commit-analyzer rules and publishes to npm via `NPM_TOKEN`

## License

MIT