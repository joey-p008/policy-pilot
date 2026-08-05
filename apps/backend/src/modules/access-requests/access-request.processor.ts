import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { ACCESS_REQUEST_QUEUE } from './access-requests.constants';
import { AccessRequestDto } from './dto/access-requests.dto';

@Processor(ACCESS_REQUEST_QUEUE)
export class AccessRequestProcessor extends WorkerHost {
  private readonly logger = new Logger(AccessRequestProcessor.name);

  public async process(job: Job<AccessRequestDto>): Promise<void> {
    this.logger.log(`Processed access-request job ${job.id ?? 'unknown'}`);
  }
}
