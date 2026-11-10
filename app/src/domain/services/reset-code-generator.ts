import { randomInt } from 'node:crypto';

export class ResetCodeGenerator {
  static generate(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
