import { Body, Controller, Post } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccessRequestsService, AccessRequestHandleResult } from './access-requests.service';
import { accessRequestSchema } from './dto/access-requests.dto';
import type { AccessRequestDto } from './dto/access-requests.dto';

@Controller('webhooks/access-requests')
export class AccessRequestsController {
  public constructor(private readonly accessRequestsService: AccessRequestsService) {}

  @Post()
  public async create(
    @Body(new ZodValidationPipe(accessRequestSchema)) body: AccessRequestDto,
  ): Promise<AccessRequestHandleResult> {
    return this.accessRequestsService.handleIncoming(body);
  }
}
