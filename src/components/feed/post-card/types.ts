// ─── Post card shared types ──────────────────────────────────

export interface PostAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  affiliations: string[];
  verificationLevel: string;
  civicReputation?: number;
}

export interface PostSource {
  url: string;
  domain: string;
  trustScore: number;
}

export interface PostReactions {
  agree: number;
  disagree: number;
  insightful: number;
  nuance: number;
}

export interface PostThread {
  id: string;
  type: string;
  topics: string[];
  participantCount: number;
  civilityScore: number;
  diversityScore: number;
}

export interface PostAlgorithm {
  qualityScore: number;
  signals: {
    engagementQuality: number;
    civility: number;
    viewpointDiversity: number;
    sourceCredibility: number;
    topicRelevance: number;
    authorReputation: number;
    penalty: number;
  };
  explanation: string;
  explanationTags: string[];
}

export interface PostReply {
  id: string;
  content: string;
  author: PostAuthor;
  createdAt: string;
  civilityScore: number;
  reactions: { agree: number; disagree: number; insightful: number };
}

export interface PostData {
  id: string;
  content: string;
  createdAt: string;
  topics: string[];
  author: PostAuthor;
  thread: PostThread | null;
  sources: PostSource[];
  reactions: PostReactions;
  algorithm: PostAlgorithm;
  replies: PostReply[];
  comment_policy?: 'everyone' | 'followers_only' | 'off';
  comment_count?: number;
  is_thread_locked?: boolean;
  postType?: string;
  _optimistic?: boolean;
  _failed?: boolean;
}

export type ReactionType = 'agree' | 'disagree' | 'insightful' | 'nuance';
