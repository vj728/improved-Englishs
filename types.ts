
export type PracticeMode = 'standard' | 'hinglish' | 'conversation' | 'custom';
export type AppTheme = 'light' | 'dark' | 'navy' | 'blue';

export interface ConversationTurn {
  question: string;
  userAnswer: string;
  suggestedAnswer?: string;
  timestamp: number;
  mode: PracticeMode;
}

export interface AppState {
  turns: ConversationTurn[];
  currentQuestion: string;
  isLoading: boolean;
  isSpeaking: boolean;
  mode: PracticeMode;
  theme: AppTheme;
}
