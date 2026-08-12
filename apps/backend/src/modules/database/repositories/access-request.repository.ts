import { Injectable } from '@nestjs/common';
import { AccessRequest, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma.service';

export const ACCESS_REQUEST_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  ESCALATED: 'ESCALATED',
} as const;

export type AccessRequestStatus =
  (typeof ACCESS_REQUEST_STATUS)[keyof typeof ACCESS_REQUEST_STATUS];

export interface CreateAccessRequestRecordInput {
  id?: string;
  requestId: string;
  employeeId: string;
  title: string;
  department: string;
  costCenter: string;
  systemName: string;
  targetEntitlement: string;
  justification: string;
  status: AccessRequestStatus;
  recommendationJson: Prisma.InputJsonValue;
}

export interface DecideAccessRequestInput {
  requestId: string;
  status: AccessRequestStatus;
  decidedByAdminId: string;
  decidedAt?: Date;
}

@Injectable()
export class AccessRequestRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateAccessRequestRecordInput): Promise<AccessRequest> {
    return this.prisma.accessRequest.create({
      data: {
        id: input.id,
        requestId: input.requestId,
        employeeId: input.employeeId,
        title: input.title,
        department: input.department,
        costCenter: input.costCenter,
        systemName: input.systemName,
        targetEntitlement: input.targetEntitlement,
        justification: input.justification,
        status: input.status,
        recommendationJson: input.recommendationJson,
      },
    });
  }

  public async findByRequestId(requestId: string): Promise<AccessRequest | null> {
    return this.prisma.accessRequest.findUnique({
      where: { requestId },
    });
  }

  public async findPendingReview(): Promise<AccessRequest[]> {
    return this.prisma.accessRequest.findMany({
      where: { status: ACCESS_REQUEST_STATUS.PENDING_REVIEW },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findDecided(): Promise<AccessRequest[]> {
    return this.prisma.accessRequest.findMany({
      where: {
        status: {
          in: [
            ACCESS_REQUEST_STATUS.APPROVED,
            ACCESS_REQUEST_STATUS.DENIED,
            ACCESS_REQUEST_STATUS.ESCALATED,
          ],
        },
      },
      orderBy: { decidedAt: 'desc' },
    });
  }

  public async markDecided(input: DecideAccessRequestInput): Promise<AccessRequest> {
    return this.prisma.accessRequest.update({
      where: { requestId: input.requestId },
      data: {
        status: input.status,
        decidedByAdminId: input.decidedByAdminId,
        decidedAt: input.decidedAt ?? new Date(),
      },
    });
  }
}
