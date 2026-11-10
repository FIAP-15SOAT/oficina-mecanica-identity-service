import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { CurrentPrincipal } from '@infrastructure/http/decorators/current-principal.decorator';
import { CustomerArea } from '@infrastructure/http/decorators/customer-area.decorator';
import { MeController as MeCleanController } from '@interface-adapters/me/me.controller';

import { ChangeOwnPasswordRequestDto } from './dto/requests/change-own-password-request.dto';
import { MeDataResponseDto } from './dto/responses/me-response.dto';

@ApiTags('Minha Conta')
@ApiProduces('application/json')
@ApiInternalServerErrorResponse({ description: 'Erro interno do servidor' })
@ApiBearerAuth('access-token')
@Controller('me')
export class MeController {
  constructor(private readonly controller: MeCleanController) {}

  @Get()
  @CustomerArea('any')
  @ApiOperation({ summary: 'Perfil do usuário autenticado (token de funcionário ou de cliente)' })
  @ApiOkResponse({ type: MeDataResponseDto })
  @ApiUnauthorizedResponse({ description: 'Não autenticado' })
  @ApiNotFoundResponse({ description: 'Usuário do token não existe mais' })
  @ApiServiceUnavailableResponse({ description: 'Work-order indisponível' })
  getMe(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<MeDataResponseDto> {
    return this.controller.getMe(principal);
  }

  @Patch('password')
  @CustomerArea('any')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Trocar a própria senha (token de funcionário ou de cliente)' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiUnauthorizedResponse({ description: 'Não autenticado ou senha atual incorreta' })
  @ApiNotFoundResponse({ description: 'Usuário do token não existe mais' })
  @ApiConflictResponse({ description: 'Nova senha é igual à senha atual' })
  @ApiUnprocessableEntityResponse({ description: 'Nova senha não atende aos requisitos de força' })
  changePassword(
    @Body() request: ChangeOwnPasswordRequestDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.controller.changePassword(principal.sub, request);
  }
}
