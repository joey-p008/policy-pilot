import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AccessRequestDecisionResult,
  AccessRequestHistoryItem,
  PendingAccessRequest,
} from '@policy-pilot/shared-types';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthPrincipal } from '../auth/auth.constants';
import { CurrentPrincipal } from '../auth/current-principal.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import {
  createHitlAccessRequestSchema,
  type CreateHitlAccessRequestDto,
} from './dto/hitl-access-requests.dto';
import { HitlAccessRequestsService } from './hitl-access-requests.service';

@Controller('access-requests')
@UseGuards(JwtAuthGuard)
export class AccessRequestsHitlController {
  public constructor(private readonly hitlAccessRequestsService: HitlAccessRequestsService) {}

  @Post()
  @Roles('user', 'admin')
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @Body(new ZodValidationPipe(createHitlAccessRequestSchema)) body: CreateHitlAccessRequestDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<PendingAccessRequest> {
    return this.hitlAccessRequestsService.createWithRecommendation(body, principal);
  }

  @Get('pending')
  @Roles('admin')
  public async listPending(): Promise<PendingAccessRequest[]> {
    return this.hitlAccessRequestsService.listPending();
  }

  @Get('history')
  @Roles('admin')
  public async listHistory(): Promise<AccessRequestHistoryItem[]> {
    return this.hitlAccessRequestsService.listHistory();
  }

  @Post(':requestId/approve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async approve(
    @Param('requestId') requestId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.approve(requestId, principal);
  }

  @Post(':requestId/deny')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async deny(
    @Param('requestId') requestId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.deny(requestId, principal);
  }

  @Post(':requestId/escalate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  public async escalate(
    @Param('requestId') requestId: string,
    @CurrentPrincipal() principal: AuthPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.escalate(requestId, principal);
  }
}
