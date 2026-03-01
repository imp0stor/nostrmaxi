export interface QaQuestionSummary {
  id: string;
  authorPubkey: string;
  title: string;
  body: string;
  tags: string[];
  bountyMsats: number;
  bountyPaid: boolean;
  viewCount: number;
  acceptedAnswerId?: string | null;
  createdAt: string;
  updatedAt: string;
  voteCount: number;
  answerCount: number;
}

export interface QaAnswer {
  id: string;
  questionId: string;
  authorPubkey: string;
  body: string;
  upvotes: number;
  downvotes: number;
  isAccepted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QaQuestionDetail {
  id: string;
  authorPubkey: string;
  title: string;
  body: string;
  tags: string[];
  bountyMsats: number;
  bountyPaid: boolean;
  viewCount: number;
  acceptedAnswerId?: string | null;
  createdAt: string;
  updatedAt: string;
  answers: QaAnswer[];
}

export interface QaTag {
  tag: string;
  questionCount: number;
}
