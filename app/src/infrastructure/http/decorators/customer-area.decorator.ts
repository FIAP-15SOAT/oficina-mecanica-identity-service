import { SetMetadata } from '@nestjs/common';

export const CUSTOMER_AREA_KEY = 'customerArea';

export type CustomerAreaMode = 'any';

export const CustomerArea = (mode: CustomerAreaMode) => SetMetadata(CUSTOMER_AREA_KEY, mode);
