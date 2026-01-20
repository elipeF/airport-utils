export class UnknownAirportError extends Error {
  constructor(iata: string) {
    super(`Unknown airport IATA code: ${iata}`);
    this.name = 'UnknownAirportError';
  }
}
export class InvalidTimestampError extends Error {
  constructor(ts: string) {
    super(`Invalid ISO 8601 timestamp: ${ts}`);
    this.name = 'InvalidTimestampError';
  }
}
export class UnknownTimezoneError extends Error {
  constructor(tz: string) {
    super(`Unknown timezone: ${tz}`);
    this.name = 'UnknownTimezoneError';
  }
}
