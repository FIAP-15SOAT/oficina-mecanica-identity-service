import { IHashService } from '@application/ports/output/services/hash.service.interface';

export function createMockHashService(): jest.Mocked<IHashService> {
  return {
    hash: jest.fn().mockResolvedValue('$2b$12$hashed'),
    compare: jest.fn().mockResolvedValue(true),
  };
}
