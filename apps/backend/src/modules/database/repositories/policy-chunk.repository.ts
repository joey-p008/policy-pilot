import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { PrismaService } from '../prisma.service';

export const PolicyChunkInsertSchema = z.object({
  documentId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  sectionTitle: z.string().min(1),
  content: z.string().min(1),
  embedding: z.array(z.number()).length(1536),
});

export type PolicyChunkInsert = z.infer<typeof PolicyChunkInsertSchema>;

@Injectable()
export class PolicyChunkRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM policy_chunks
      WHERE document_id = ${documentId}
    `;
    return Number(result);
  }

  public async bulkInsert(rows: PolicyChunkInsert[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const validated = rows.map((row) => PolicyChunkInsertSchema.parse(row));

    await this.prisma.$transaction(async (tx) => {
      for (const row of validated) {
        const id = randomUUID();
        const embeddingLiteral = `[${row.embedding.join(',')}]`;

        await tx.$executeRaw`
          INSERT INTO policy_chunks (
            id,
            document_id,
            page_number,
            section_title,
            content,
            embedding
          )
          VALUES (
            ${id}::uuid,
            ${row.documentId},
            ${row.pageNumber},
            ${row.sectionTitle},
            ${row.content},
            ${embeddingLiteral}::vector
          )
        `;
      }
    });

    return validated.length;
  }
}
