// src/features/forum/validation.ts
import { z } from "zod";

export const createQuestionSchema = z.object({
  title: z.string().min(10).max(200),
  body_markdown: z.string().min(3),
  tags: z.array(z.string()).max(5).optional().default([]),
});

export const createCommentSchema = z.object({
  question_id: z.string().uuid(),
  body_markdown: z.string().min(2),
});

export const voteSchema = z.object({
  comment_id: z.string().uuid(),
  value: z.enum(['AGREE','PARTIAL','MISLEADING']),
});
