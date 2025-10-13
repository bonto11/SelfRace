// src/features/forum/types.ts
export type VoteValue = 'AGREE' | 'PARTIAL' | 'MISLEADING';

export type ForumQuestion = {
  id: string;
  author_id: string;
  title: string;
  body_markdown: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

export type ForumComment = {
  id: string;
  question_id: string;
  author_id: string;
  body_markdown: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
};

export type CommentWithVotes = ForumComment & {
  votes: Record<VoteValue, number>;
  my_vote?: VoteValue | null;
};
