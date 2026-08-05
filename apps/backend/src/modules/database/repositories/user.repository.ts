import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

import { PrismaService } from '../prisma.service';

export interface CreateUserInput {
  employeeIdHash: string;
  department: string;
  costCenterHash: string;
  role: string;
  id?: string;
}

@Injectable()
export class UserRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        id: input.id,
        employeeIdHash: input.employeeIdHash,
        department: input.department,
        costCenterHash: input.costCenterHash,
        role: input.role,
      },
    });
  }

  public async findByEmployeeIdHash(employeeIdHash: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { employeeIdHash },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
