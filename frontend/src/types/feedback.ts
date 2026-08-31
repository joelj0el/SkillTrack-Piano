export interface FeedbackItem {
  notePosition?: number;
  message: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface SessionFeedback {
  items: FeedbackItem[];
  overallScore?: number;
}
