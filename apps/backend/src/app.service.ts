import { Injectable } from '@nestjs/common';
import type { BaseAccessRequest } from '@policy-pilot/shared-types';

export interface HealthResponse {
  status: 'ok';
  service: string;
  accessRequestShape: keyof BaseAccessRequest;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    const shapeKeys: Array<keyof BaseAccessRequest> = [
      'requestId',
      'employeeId',
      'targetEntitlement',
    ];

    return {
      status: 'ok',
      service: '@policy-pilot/backend',
      accessRequestShape: shapeKeys[0],
    };
  }
}
