export const TYPES = ['letters', 'words', 'sentences', 'pictures', 'stories'] as const;
export type ExerciseType = (typeof TYPES)[number];

export const TYPE_INFO: Record<ExerciseType, { label: string; icon: string; blurb: string }> = {
  letters: { label: 'Letters', icon: '🔤', blurb: 'Listen and find the letter' },
  words: { label: 'Words', icon: '🧩', blurb: 'Listen and find the word' },
  sentences: { label: 'Sentences', icon: '✏️', blurb: 'Find the missing word' },
  pictures: { label: 'Pictures', icon: '🖼️', blurb: 'Match the sentence to the picture' },
  stories: { label: 'Stories', icon: '📖', blurb: 'Read a story and answer questions' },
};

export type Picture = { emoji: string } | { imageId: number };

export interface LettersContent { items: Array<{ target: string; say: string; options: string[] }> }
export interface WordsContent { items: Array<{ target: string; options: string[] }> }
export interface SentencesContent { items: Array<{ sentence: string; answer: string; options: string[] }> }
export interface PicturesContent { items: Array<{ sentence: string; picture: Picture }> }
export interface StoriesContent { text: string; questions: Array<{ question: string; answer: string; options: string[] }> }
export type Content = LettersContent | WordsContent | SentencesContent | PicturesContent | StoriesContent;

export interface Exercise {
  id: number;
  type: ExerciseType;
  level: number;
  title: string;
  shared: boolean;
  archived: boolean;
  timeLimitS: number;
  content: Content;
  createdAt: string;
}

export interface Settings {
  font: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  background: string;
  highlight: string;
  speechRate: number;
}

export interface StudentMe {
  id: number;
  name: string;
  number: string;
  points: number;
  className: string;
  settings: Settings;
}

export type Me =
  | { kind: 'teacher'; teacher: { id: number; name: string; email: string } }
  | { kind: 'student'; student: StudentMe }
  | { kind: null };

export interface MarkedAnswer { given: string | null; ms: number; correct: boolean; answer: string }

export interface ResultResponse {
  correct: number;
  total: number;
  points: number;
  totalPoints: number;
  level: number;
  newLevel: number;
  answers: MarkedAnswer[];
}

export type Levels = Record<ExerciseType, number>;
