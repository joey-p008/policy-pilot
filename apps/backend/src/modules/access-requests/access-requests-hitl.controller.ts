import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AccessRequestDecisionResult, PendingAccessRequest } from '@policy-pilot/shared-types';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createHitlAccessRequestSchema,
  hitlDecisionBodySchema,
  type CreateHitlAccessRequestDto,
  type HitlDecisionBodyDto,
} from './dto/hitl-access-requests.dto';
import { HitlAccessRequestsService } from './hitl-access-requests.service';

@Controller('access-requests')
export class AccessRequestsHitlController {
  public constructor(private readonly hitlAccessRequestsService: HitlAccessRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @Body(new ZodValidationPipe(createHitlAccessRequestSchema)) body: CreateHitlAccessRequestDto,
  ): Promise<PendingAccessRequest> {
    return this.hitlAccessRequestsService.createWithRecommendation(body);
  }

  @Get('pending')
  public async listPending(): Promise<PendingAccessRequest[]> {
    return this.hitlAccessRequestsService.listPending();
  }

  @Post(':requestId/approve')
  @HttpCode(HttpStatus.OK)
  public async approve(
    @Param('requestId') requestId: string,
    @Body(new ZodValidationPipe(hitlDecisionBodySchema)) body: HitlDecisionBodyDto,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.approve(requestId, body.admin_id);
  }

  @Post(':requestId/deny')
  @HttpCode(HttpStatus.OK)
  public async deny(
    @Param('requestId') requestId: string,
    @Body(new ZodValidationPipe(hitlDecisionBodySchema)) body: HitlDecisionBodyDto,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.deny(requestId, body.admin_id);
  }

  @Post(':requestId/escalate')
  @HttpCode(HttpStatus.OK)
  public async escalate(
    @Param('requestId') requestId: string,
    @Body(new ZodValidationPipe(hitlDecisionBodySchema)) body: HitlDecisionBodyDto,
  ): Promise<AccessRequestDecisionResult> {
    return this.hitlAccessRequestsService.escalate(requestId, body.admin_id);
  }
}
