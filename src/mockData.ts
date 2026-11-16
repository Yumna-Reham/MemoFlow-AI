export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export const WORKSPACE_CATEGORIES = [
  'All Contexts',
  'Personal',
  'University',
  'Office',
  'Research',
  'Projects',
  'Finance',
  'Travel',
  'Custom'
] as const;

export type WorkspaceCategory = typeof WORKSPACE_CATEGORIES[number];

export interface NoteAttachment {
  id?: string;
  name: string;
  type: string;
  url: string;
  path?: string;
  sizeBytes?: number;
}

export interface Note {
  id: string;
  title: string;
  type: 'note' | 'screenshot' | 'pdf' | 'voice' | 'image' | 'website' | 'link' | 'youtube' | 'chatgpt' | 'whatsapp' | 'docx' | 'ocr';
  content: string;
  summary: string;
  takeaways: string[];
  tasks: Task[];
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  collection: string;
  category?: string;
  tags: string[];
  savedDate: string;
  savedTime: string;
  pinned: boolean;
  coverImage?: string;
  originalUrl?: string;
  audioDuration?: string;
  attachments?: NoteAttachment[];
  metadata?: Record<string, any>;
}

export interface Collection {
  id: string;
  name: string;
  coverGradient: string;
  itemCount: number;
  progress: number; // e.g. 75%
  color: string;
}

export const initialCollections: Collection[] = [];

export const initialNotes: Note[] = [];

export interface InsightStat {
  day: string;
  saved: number;
  reviewed: number;
  time: number; // in minutes
}

export const weeklyStats: InsightStat[] = [
  { day: 'Mon', saved: 0, reviewed: 0, time: 0 },
  { day: 'Tue', saved: 0, reviewed: 0, time: 0 },
  { day: 'Wed', saved: 0, reviewed: 0, time: 0 },
  { day: 'Thu', saved: 0, reviewed: 0, time: 0 },
  { day: 'Fri', saved: 0, reviewed: 0, time: 0 },
  { day: 'Sat', saved: 0, reviewed: 0, time: 0 },
  { day: 'Sun', saved: 0, reviewed: 0, time: 0 },
];

export interface FAQItem {
  q: string;
  a: string;
}

export const landingFAQs: FAQItem[] = [
  {
    q: "What can I save?",
    a: "You can save text notes, image screenshots, PDFs, voice recordings, web URLs, YouTube links, ChatGPT transcripts, and WhatsApp export logs. MemoFlow AI processes all input formats automatically."
  },
  {
    q: "Can I search using natural language?",
    a: "Yes! Press Ctrl+K anywhere in your workspace to search using natural questions like 'Find my React performance notes' or 'What were my takeaways from the marketing PDF?'. Semantic search retrieves matching concepts regardless of exact wording."
  },
  {
    q: "Does OCR work on screenshots?",
    a: "Yes. Our computer vision OCR engine automatically parses readable text from image uploads and code screenshots, making image text fully searchable."
  },
  {
    q: "Which file types are supported?",
    a: "MemoFlow AI supports PDF, PNG, JPG, WEBP, MP3, WAV, M4A, MP4, TXT, DOCX, and Markdown files up to 50MB per file."
  },
  {
    q: "Is my data private?",
    a: "Your data privacy is our top priority. All documents, audio recordings, and notes are encrypted in transit and at rest using enterprise-grade AES-256 encryption. We never train public LLMs on your private memory graph."
  },
  {
    q: "Can I organize my memories manually?",
    a: "While MemoFlow AI automatically tags and routes saved items into intelligent collections, you can always create custom collection folders, edit tags, pin key documents, and re-organize items manually."
  },
  {
    q: "How does AI understand my documents?",
    a: "MemoFlow processes incoming items through multi-stage ingestion: OCR for images, transcription for audio, text extraction for documents, followed by semantic concept indexing and core takeaway synthesis."
  }
];
