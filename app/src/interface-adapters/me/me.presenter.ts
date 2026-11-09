import { UserProfile } from '@application/ports/input/me/get-user-profile.use-case.interface';

import { MeDataResponse } from './responses/me.response';

export class MePresenter {
  /** Lists only the companies the user represents: the user's own INDIVIDUAL record is left out. */
  static toMeDataResponse(profile: UserProfile): MeDataResponse {
    return {
      data: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        customers: profile.customers
          .filter((customer) => customer.type === 'COMPANY')
          .map((customer) => ({ id: customer.id, name: customer.name, type: customer.type })),
      },
    };
  }
}
