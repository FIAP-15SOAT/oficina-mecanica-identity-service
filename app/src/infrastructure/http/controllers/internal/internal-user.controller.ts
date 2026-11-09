import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@infrastructure/http/decorators/public.decorator';
import { INTERNAL_PREFIX } from '@infrastructure/http/http.constants';

import { InternalUserController as InternalUserCleanController } from '@interface-adapters/user/internal-user.controller';
import {
  InternalCustomerAuthenticationDataResponse,
  InternalCustomerUserDataResponse,
  InternalUserDataResponse,
} from '@interface-adapters/user/responses/internal-user.response';

import { AuthenticateCustomerCredentialRequestDto } from './dto/requests/authenticate-customer-credential-request.dto';
import { EnsureCustomerUserRequestDto } from './dto/requests/ensure-customer-user-request.dto';

@ApiExcludeController()
@Public()
@Controller(INTERNAL_PREFIX)
export class InternalUserController {
  constructor(private readonly controller: InternalUserCleanController) {}

  @Get('users/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<InternalUserDataResponse> {
    return this.controller.findOne(id);
  }

  @Post('customer-users')
  @HttpCode(HttpStatus.OK)
  ensureCustomerUser(
    @Body() request: EnsureCustomerUserRequestDto,
  ): Promise<InternalCustomerUserDataResponse> {
    return this.controller.ensureCustomerUser(request);
  }

  @Post('customer-authentications')
  @HttpCode(HttpStatus.OK)
  authenticateCustomerCredential(
    @Body() request: AuthenticateCustomerCredentialRequestDto,
  ): Promise<InternalCustomerAuthenticationDataResponse> {
    return this.controller.authenticateCustomerCredential(request);
  }
}
