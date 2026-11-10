import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readContractFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, `../contracts/${name}`), 'utf8'));
}

// Keys at every level mapped to their JSON type; the fixture's `$source` header is not part of the contract.
export function jsonShape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(jsonShape);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '$source')
        .map(([key, nested]) => [key, jsonShape(nested)]),
    );
  }

  return value === null ? 'null' : typeof value;
}
