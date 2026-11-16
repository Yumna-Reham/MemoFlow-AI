'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Star, Share2, Download, BookOpen, Brain, CheckCircle, 
  HelpCircle, MessageSquare, ArrowLeft, Check, File, Image as ImageIcon, 
  ExternalLink, Paperclip, Trash2, Edit3, Send, Bot, Zap, Info, ListTodo,
  Mic, Volume2
} from 'lucide-react';
import { Note, Task, QuizQuestion, NoteAttachment } from '../mockData';
import { notesService } from '@/lib/services/notesService';
import { collectionsService } from '@/lib/services/collectionsService';
import { storageService } from '@/lib/services/storageService';

// Helper to parse **bold** text in Markdown
const parseBoldText = (str: string) => {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Safe lightweight Markdown formatter for Ask MemoFlow chat responses
const renderFormattedMessage = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-1" />;

        if (trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <div key={lIdx} className="font-extrabold text-[13px] text-purple-950 pt-1">
              {parseBoldText(headerText)}
            </div>
          );
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-1">
              <span className="text-purple-600 font-bold select-none">•</span>
              <span className="flex-1">{parseBoldText(bulletText)}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-1">
              <span className="font-extrabold text-purple-700 select-none text-[11px]">{numMatch[1]}.</span>
              <span className="flex-1">{parseBoldText(numMatch[2])}</span>
            </div>
          );
        }

        return <p key={lIdx}>{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
};

interface NoteDetailViewProps {
  note: Note;
  onClose: () => void;
  onUpdateNote: (updatedNote: Note) => void;
  onDeleteNote?: (noteId: string) => void;
}

export default function NoteDetailView({ note, onClose, onUpdateNote, onDeleteNote }: NoteDetailViewProps) {
  const [aiTab, setAiTab] = useState<'chat' | 'summary' | 'tasks' | 'quiz'>('chat');
  
  // Interactive Takeaway Highlight state
  const [activeTakeawayIdx, setActiveTakeawayIdx] = useState<number | null>(null);
  const contentBoxRef = useRef<HTMLDivElement>(null);

  // Dynamic 2-row tag measurement state (presentation only, data untouched)
  const measureTagsRef = useRef<HTMLDivElement>(null);
  const [visibleTagCount, setVisibleTagCount] = useState<number>(() => note.tags?.length || 0);

  useEffect(() => {
    const el = measureTagsRef.current;
    if (!el) return;

    const computeVisibleTags = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) return;

      const rowTops: number[] = [];
      let allowedCount = 0;

      for (let i = 0; i < children.length; i++) {
        const top = children[i].offsetTop;
        const isExistingRow = rowTops.some(r => Math.abs(r - top) < 6);
        if (!isExistingRow) {
          rowTops.push(top);
        }
        if (rowTops.length <= 2) {
          allowedCount = i + 1;
        } else {
          break;
        }
      }

      const count = note.category ? Math.max(0, allowedCount - 1) : allowedCount;
      setVisibleTagCount(count);
    };

    computeVisibleTags();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(computeVisibleTags);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [note.id, note.tags, note.category]);

  // Quiz states
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizStatusMsg, setQuizStatusMsg] = useState<string | null>(null);
  const [quizNumQuestions, setQuizNumQuestions] = useState<number>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<string>('medium');

  // Memoized shuffled quiz: shuffles existing options for each question so correct answers are distributed across A, B, C, D
  const activeQuiz = useMemo(() => {
    if (!note.quiz || note.quiz.length === 0) return [];
    return note.quiz.map((q, qIdx) => {
      if (!Array.isArray(q.options) || q.options.length <= 1) return q;

      const originalCorrectIndex = typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < q.options.length
        ? q.correctAnswer
        : 0;
      const correctOptionText = q.options[originalCorrectIndex];

      // Deterministic PRNG seeded by question ID, question text, and question index
      let h = 0x811c9dc5 ^ (qIdx + 1);
      const seedStr = `${q.id || ''}_${q.question || ''}`;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      let s = h >>> 0;
      const rng = () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
      };

      const shuffled = [...q.options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }

      // Ensure Question 1 does not stay fixed on Option A if it happened to land there
      let newCorrectIndex = shuffled.indexOf(correctOptionText);
      if (qIdx === 0 && newCorrectIndex === 0 && shuffled.length > 1) {
        const swapTarget = 1 + Math.floor(rng() * (shuffled.length - 1));
        const temp = shuffled[0];
        shuffled[0] = shuffled[swapTarget];
        shuffled[swapTarget] = temp;
        newCorrectIndex = swapTarget;
      }

      return {
        ...q,
        options: shuffled,
        correctAnswer: newCorrectIndex >= 0 ? newCorrectIndex : 0
      };
    });
  }, [note.id, note.quiz]);

  // Task Extraction state
  const [isExtractingTasks, setIsExtractingTasks] = useState(false);
  const [tasksStatusMsg, setTasksStatusMsg] = useState<string | null>(null);

  // AI Chat states
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Explicit On-Demand OCR & Summary States
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryStatusMsg, setSummaryStatusMsg] = useState<string | null>(null);

  // Find image attachment if present on note
  const imageAttachment = note.attachments?.find(a => 
    a.type?.startsWith('image/') || 
    a.url?.startsWith('data:image/') || 
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(a.name?.split('.').pop()?.toLowerCase() || '')
  );

  const [currentImageSrc, setCurrentImageSrc] = useState<string | undefined>(imageAttachment?.url);

  useEffect(() => {
    setCurrentImageSrc(imageAttachment?.url);
  }, [imageAttachment?.url]);

  // Find audio attachment if present on note
  const audioAttachment = note.attachments?.find(a => 
    a.type?.startsWith('audio/') || 
    ['webm', 'wav', 'mp3', 'ogg', 'm4a', 'aac'].includes(a.name?.split('.').pop()?.toLowerCase() || '') ||
    (note.type === 'voice' && a.url)
  );

  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | undefined>(audioAttachment?.url);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [audioStatusMsg, setAudioStatusMsg] = useState<string | null>(null);
  const [downloadingAttId, setDownloadingAttId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentAudioSrc(audioAttachment?.url);
  }, [audioAttachment?.url]);

  // Safe deduplication for rendering attached files
  const displayAttachments = useMemo(() => {
    if (!note.attachments || note.attachments.length === 0) return [];
    const seen = new Set<string>();
    const deduplicated: NoteAttachment[] = [];
    for (const att of note.attachments) {
      const canonicalKey = att.path || storageService.extractPath(att.url) || att.url || att.name;
      if (canonicalKey && !seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        deduplicated.push(att);
      }
    }
    return deduplicated;
  }, [note.attachments]);

  const handleImageError = async () => {
    if (imageAttachment) {
      const fresh = await storageService.getSignedUrl(imageAttachment.path || imageAttachment.url);
      if (fresh && fresh !== currentImageSrc) {
        setCurrentImageSrc(fresh);
      }
    }
  };

  const hasDocxEmbeddedImages = note.content?.includes('[DOCX_HAS_EMBEDDED_IMAGES]');
  const cleanDisplayContent = (note.content || '').replace('[DOCX_HAS_EMBEDDED_IMAGES]', '').trim();

  // Initialize context-bound chat messages whenever note changes
  useEffect(() => {
    setChatMessages([
      { 
        sender: 'ai', 
        text: `Hi! I’m MemoFlow AI. Ask me anything about "${note.title}" or click "Extract Text (OCR)" / "Transcribe Audio" / "Summarize with AI" whenever you need on-demand AI processing.` 
      }
    ]);
    setSelectedAnswers({});
    setQuizScore(null);
    setOcrStatusMsg(null);
    setAudioStatusMsg(null);
    setIsTranscribingAudio(false);
    setDownloadingAttId(null);
    setSummaryStatusMsg(null);
    setQuizStatusMsg(null);
    setTasksStatusMsg(null);
    setActiveTakeawayIdx(null);
  }, [note.id, note.title]);

  const handleExtractTextOcr = async () => {
    if (!imageAttachment || !imageAttachment.url) {
      alert('No image attachment found on this memory note.');
      return;
    }

    setIsExtractingOcr(true);
    setOcrStatusMsg('Running MemoFlow AI OCR...');

    try {
      let imageBase64 = '';
      let mimeType = imageAttachment.type || 'image/png';

      if (imageAttachment.url.startsWith('data:image/')) {
        const parts = imageAttachment.url.split(';base64,');
        mimeType = parts[0].replace('data:', '');
        imageBase64 = parts[1];
      } else {
        const resUrl = await fetch(imageAttachment.url);
        const blob = await resUrl.blob();
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType })
      });

      const data = await res.json();
      if (res.ok && data.success && data.text) {
        setOcrStatusMsg('Text extracted successfully!');
        const updatedNote: Note = {
          ...note,
          content: data.text,
          summary: `Extracted text from image "${note.title}". Ready for AI summary.`,
        };
        onUpdateNote(updatedNote);
      } else {
        const err = data.error || 'Failed to extract text from image.';
        if (err.includes('429') || err.toLowerCase().includes('quota') || err.includes('rate-limit')) {
          setOcrStatusMsg('AI is temporarily busy. Please try again in a moment.');
        } else {
          setOcrStatusMsg(`OCR Notice: ${err}`);
        }
      }
    } catch (err: any) {
      console.error('[MEMOFLOW OCR] On-demand OCR error:', err);
      setOcrStatusMsg('AI is temporarily busy. Please try again in a moment.');
    } finally {
      setIsExtractingOcr(false);
    }
  };

  const handleTranscribeAudioNote = async () => {
    if (!audioAttachment || !audioAttachment.url) {
      alert('No audio attachment found on this memory note.');
      return;
    }

    setIsTranscribingAudio(true);
    setAudioStatusMsg('Transcribing audio...');

    try {
      let audioUrlToFetch = currentAudioSrc || audioAttachment.url;
      if (!audioUrlToFetch.startsWith('http') && !audioUrlToFetch.startsWith('data:') && !audioUrlToFetch.startsWith('blob:')) {
        const fresh = await storageService.getSignedUrl(audioAttachment.path || audioAttachment.url);
        if (fresh) {
          audioUrlToFetch = fresh;
          setCurrentAudioSrc(fresh);
        }
      }

      const resUrl = await fetch(audioUrlToFetch);
      const blob = await resUrl.blob();
      const reader = new FileReader();
      const audioBase64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const mimeType = audioAttachment.type || blob.type || 'audio/webm';
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'audio', fileBase64: audioBase64, url: mimeType })
      });

      const data = await res.json();
      if (res.ok && data.success && data.text) {
        setAudioStatusMsg('Audio transcribed successfully!');
        const updatedNote: Note = {
          ...note,
          content: data.text,
          summary: `Voice memo transcript: ${data.text.slice(0, 160)}${data.text.length > 160 ? '...' : ''}`,
          takeaways: [
            `Spoken transcript: "${data.text.slice(0, 100)}${data.text.length > 100 ? '...' : ''}"`,
            `Categorized under ${note.category || 'Personal'} context.`
          ]
        };
        await notesService.updateNote(updatedNote);
        onUpdateNote(updatedNote);
      } else {
        const err = data.error || 'Failed to transcribe audio.';
        setAudioStatusMsg(`Transcription notice: ${err}`);
      }
    } catch (err: any) {
      console.error('[MEMOFLOW AUDIO] On-demand transcription error:', err);
      setAudioStatusMsg('Failed to transcribe audio.');
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummaryStatusMsg('Generating AI summary...');

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: cleanDisplayContent,
          category: note.category || 'Personal'
        })
      });

      const data = await res.json();
      if (res.ok && data.summary) {
        setSummaryStatusMsg('Summary generated successfully!');
        const updatedNote: Note = {
          ...note,
          summary: data.summary,
          takeaways: data.takeaways || note.takeaways,
          tags: data.suggestedTags ? Array.from(new Set([...note.tags, ...data.suggestedTags])) : note.tags
        };
        onUpdateNote(updatedNote);
      } else {
        const err = data.error || 'Failed to generate summary.';
        if (err.includes('429') || err.toLowerCase().includes('quota')) {
          setSummaryStatusMsg('AI is temporarily busy. Please try again in a moment.');
        } else {
          setSummaryStatusMsg(`Summary notice: ${err}`);
        }
      }
    } catch (err: any) {
      console.error('[MEMOFLOW SUMMARY] On-demand summary error:', err);
      setSummaryStatusMsg('AI is temporarily busy. Please try again in a moment.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizStatusMsg('Generating AI quiz...');

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: cleanDisplayContent,
          numQuestions: quizNumQuestions,
          difficulty: quizDifficulty
        })
      });

      const data = await res.json();
      if (res.ok && data.quiz && data.quiz.length > 0) {
        setSelectedAnswers({});
        setQuizScore(null);
        setQuizStatusMsg('Quiz generated successfully!');
        const updatedNote: Note = {
          ...note,
          quiz: data.quiz
        };
        onUpdateNote(updatedNote);
      } else {
        setQuizStatusMsg(data.error || 'Quiz generation is temporarily unavailable. Please try again.');
      }
    } catch (err: any) {
      setQuizStatusMsg('Quiz generation is temporarily unavailable. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleExtractTasks = async () => {
    setIsExtractingTasks(true);
    setTasksStatusMsg('Detecting action items...');

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: cleanDisplayContent,
          category: note.category || 'Personal'
        })
      });

      const data = await res.json();
      if (res.ok && data.extractedTasks) {
        setTasksStatusMsg('Action items updated!');
        const newTasks: Task[] = data.extractedTasks.map((tText: string, idx: number) => ({
          id: `task-${Date.now()}-${idx}`,
          text: tText,
          completed: false
        }));

        const updatedNote: Note = {
          ...note,
          tasks: newTasks.length > 0 ? newTasks : note.tasks
        };
        onUpdateNote(updatedNote);
      } else {
        setTasksStatusMsg('No new action items detected.');
      }
    } catch (err) {
      setTasksStatusMsg('AI is temporarily busy. Please try again in a moment.');
    } finally {
      setIsExtractingTasks(false);
    }
  };

  // Toggle tasks check (Local - NO AI call)
  const handleToggleTask = (taskId: string) => {
    const updatedTasks = note.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    onUpdateNote({
      ...note,
      tasks: updatedTasks
    });
  };

  // Submit MCQ answers
  const handleSelectQuizOption = (questionId: string, optionIdx: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }));
  };

  const handleEvaluateQuiz = () => {
    let score = 0;
    activeQuiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        score++;
      }
    });
    setQuizScore(score);
  };

  const handleTakeawayClick = (idx: number) => {
    setActiveTakeawayIdx(idx);
    if (contentBoxRef.current) {
      contentBoxRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const sendingRef = useRef(false);

  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isAiThinking || sendingRef.current) return;

    sendingRef.current = true;
    const userQuery = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setChatInput('');
    setIsAiThinking(true);

    try {
      // Determine if note has usable extracted text already available
      const rawContent = cleanDisplayContent;
      const hasUsableExtractedText = 
        rawContent.length > 0 && 
        rawContent !== '[Saved Image Node]' && 
        !rawContent.startsWith('[OCR_FAILED]') &&
        !rawContent.startsWith('[PDF_FAILED]') &&
        !rawContent.startsWith('[DOCX_FAILED]');

      let imageBase64: string | undefined = undefined;
      let imageMime: string | undefined = undefined;

      // Only attach imageBase64 if text has NOT been extracted yet
      if (!hasUsableExtractedText) {
        const imageAtt = note.attachments?.find(a => 
          a.type?.startsWith('image/') || 
          a.url?.startsWith('data:image/')
        );

        if (imageAtt?.url?.startsWith('data:image/')) {
          const parts = imageAtt.url.split(';base64,');
          imageMime = parts[0].replace('data:', '');
          imageBase64 = parts[1];
        }
      }

      if (hasUsableExtractedText || !imageBase64) {
        console.log('[MEMOFLOW CHAT] CHAT CONTEXT: TEXT ONLY');
      } else {
        console.log('[MEMOFLOW CHAT] CHAT CONTEXT: IMAGE + TEXT');
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          activeNote: {
            title: note.title,
            content: cleanDisplayContent,
            type: note.type,
            summary: note.summary,
            imageBase64,
            imageMime
          },
          imageBase64,
          imageMime
        })
      });

      const data = await res.json();
      const aiResponse = data.answer || data.error || "MemoFlow AI couldn't complete that request. Please try again.";
      setChatMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
    } catch (err: any) {
      console.error('[MEMOFLOW CHAT] Error calling chat API:', err);
      setChatMessages(prev => [...prev, { 
        sender: 'ai', 
        text: `MemoFlow AI couldn't complete that request. Please try again.` 
      }]);
    } finally {
      setIsAiThinking(false);
      sendingRef.current = false;
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([`# ${note.title}\n\nDate: ${note.savedDate}\nCategory: ${note.category || 'Personal'}\n\n## Note Content\n${cleanDisplayContent}\n\n## Summary\n${note.summary || ''}`], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getCleanFilename = (name: string) => {
    if (!name) return 'Attached File';
    if (name.length <= 26) return name;
    const parts = name.split('.');
    if (parts.length > 1) {
      const ext = parts.pop();
      const base = parts.join('.');
      return `${base.slice(0, 18)}...${ext}`;
    }
    return `${name.slice(0, 22)}...`;
  };

  const handleDownloadAttachment = async (att: NoteAttachment) => {
    const attId = att.id || att.path || att.name;
    setDownloadingAttId(attId);
    try {
      const cleanName = att.name || 'attachment';
      const success = await storageService.downloadFile(att.path || att.url, cleanName);
      if (!success) {
        const signedUrl = await storageService.getSignedUrl(att.path || att.url, 300, cleanName);
        if (signedUrl) {
          const a = document.createElement('a');
          a.href = signedUrl;
          a.download = cleanName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (document.body.contains(a)) document.body.removeChild(a);
          }, 200);
        }
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
    } finally {
      setDownloadingAttId(null);
    }
  };

  const hasRealSummary = note.summary && note.summary.trim().length > 0 && !note.summary.includes('AI generated summary for your saved');
  const hasRealTakeaways = note.takeaways && note.takeaways.length > 0 && !note.takeaways[0]?.includes('Extracted core takeaway');

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full bg-slate-50 relative z-30 font-sans select-none">
      
      {/* Top Header Bar */}
      <div className="px-5 md:px-6 py-2.5 border-b border-slate-200/80 bg-white flex items-center justify-between shadow-2xs shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-purple-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-purple-600" /> 
          <span>Back to Notes</span>
        </button>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onUpdateNote({ ...note, pinned: !note.pinned })}
            className={`p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer ${
              note.pinned ? 'text-amber-500 border-amber-200 bg-amber-50/50' : 'text-slate-500 hover:text-slate-800'
            }`}
            title={note.pinned ? "Unpin Note" : "Pin Note"}
          >
            <Star className={`w-4 h-4 ${note.pinned ? 'fill-current' : ''}`} />
          </button>
          
          <button 
            onClick={handleDownload}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            title="Download Note (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          {onDeleteNote && (
            <button 
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
                  onDeleteNote(note.id);
                  onClose();
                }
              }}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 transition-all cursor-pointer"
              title="Delete Note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Panels Workspace - Responsive Scrollable Layout */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left Body Column - Main Memory / Document */}
        <div className="flex-1 min-h-0 overflow-y-auto pt-2.5 pb-5 px-3 md:pt-2.5 md:pb-5 md:pl-3.5 md:pr-3 space-y-3.5 bg-slate-50">
          
          {/* Note Metadata Header Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
            
            <div className="space-y-2 relative">
              {/* Invisible measurement container to compute whole tags fitting in max 2 rows */}
              <div
                ref={measureTagsRef}
                aria-hidden="true"
                className="absolute top-0 left-0 w-full pointer-events-none opacity-0 -z-50 invisible flex flex-wrap items-center gap-2"
              >
                {note.category && (
                  <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200/60 px-2.5 py-1 rounded-xl">
                    Context: {note.category}
                  </span>
                )}
                {note.tags.map(t => (
                  <span key={t} className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                    #{t}
                  </span>
                ))}
              </div>

              {/* Visible tags: strictly complete items only, max 2 full rows, zero clipping */}
              <div className="flex flex-wrap items-center gap-2">
                {note.category && (
                  <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200/60 px-2.5 py-1 rounded-xl">
                    Context: {note.category}
                  </span>
                )}
                {note.tags.slice(0, visibleTagCount).map(t => (
                  <span key={t} className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg">
                    #{t}
                  </span>
                ))}
              </div>

              <h1 className="text-base md:text-lg font-extrabold text-slate-900 tracking-tight leading-snug">
                {note.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Created {note.savedDate}</span>
                <span>•</span>
                <span className="capitalize">{note.type} Format</span>
                <span>•</span>
                <div className="inline-flex items-center gap-1.5 bg-purple-50/80 border border-purple-200/80 px-2.5 py-1 rounded-xl text-xs font-bold text-purple-900">
                  <span className="text-purple-600">Collection:</span>
                  <select
                    value={note.collection && note.collection !== 'unassigned' && note.collection !== 'general' ? note.collection : ''}
                    onChange={async (e) => {
                      const newCol = e.target.value;
                      const updated = { 
                        ...note, 
                        collection: newCol,
                        category: newCol || note.category || 'Personal'
                      };
                      await notesService.updateNote(updated);
                      onUpdateNote(updated);
                    }}
                    className="bg-transparent font-extrabold text-purple-700 focus:outline-none cursor-pointer"
                  >
                    <option value="">No Collection (Unassigned)</option>
                    <option value="University">🎓 University</option>
                    <option value="Office">💼 Office</option>
                    <option value="MemoFlow">⚡ MemoFlow</option>
                    <option value="Research">🔮 Research</option>
                    <option value="Personal">📚 Personal</option>
                    {collectionsService.getStoredCollections().map(c => (
                      <option key={c.id} value={c.name}>{c.icon || '📁'} {c.name}</option>
                    ))}
                  </select>
                </div>
                {note.originalUrl && (
                  <>
                    <span>•</span>
                    <a
                      href={note.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200/80 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
                      title={note.originalUrl}
                    >
                      <span>Original Source</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* DOCX Embedded Images Banner */}
            {hasDocxEmbeddedImages && (
              <div className="py-2.5 px-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs font-bold text-purple-900">
                  <Info className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>This Word document contains embedded images.</span>
                </div>
                <button
                  type="button"
                  onClick={handleExtractTextOcr}
                  disabled={isExtractingOcr}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Brain className={`w-3.5 h-3.5 ${isExtractingOcr ? 'animate-spin' : ''}`} />
                  <span>{isExtractingOcr ? 'Running OCR...' : 'Extract Text from Images'}</span>
                </button>
              </div>
            )}

            {/* Primary Image Preview Card & On-Demand OCR Action */}
            {imageAttachment && imageAttachment.url && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Saved Image Preview</span>
                  </h3>

                  <button
                    type="button"
                    onClick={handleExtractTextOcr}
                    disabled={isExtractingOcr}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <Brain className={`w-3.5 h-3.5 text-purple-600 ${isExtractingOcr ? 'animate-spin' : ''}`} />
                    <span>{isExtractingOcr ? 'Extracting Text...' : 'Extract Text (OCR)'}</span>
                  </button>
                </div>

                <div className="p-2.5 bg-slate-100/70 border border-slate-200/80 rounded-2xl flex items-center justify-center overflow-hidden max-h-[380px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={currentImageSrc || imageAttachment.url} 
                    onError={handleImageError}
                    alt={note.title} 
                    className="max-h-[350px] w-auto max-w-full rounded-xl object-contain shadow-2xs"
                  />
                </div>

                {ocrStatusMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${ocrStatusMsg.includes('busy') || ocrStatusMsg.includes('Notice') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                    {ocrStatusMsg}
                  </div>
                )}
              </div>
            )}

            {/* Voice Audio Preview & On-Demand Transcription Action */}
            {((audioAttachment && audioAttachment.url) || note.type === 'voice') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-600" />
                    <span>Voice Memo Audio</span>
                  </h3>

                  {audioAttachment?.url && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(audioAttachment)}
                        disabled={downloadingAttId === (audioAttachment.id || audioAttachment.path || audioAttachment.name)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                        title="Download Audio File"
                      >
                        <Download className={`w-3.5 h-3.5 text-purple-600 ${downloadingAttId === (audioAttachment.id || audioAttachment.path || audioAttachment.name) ? 'animate-bounce' : ''}`} />
                        <span>{downloadingAttId === (audioAttachment.id || audioAttachment.path || audioAttachment.name) ? 'Downloading...' : 'Download Audio'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTranscribeAudioNote}
                        disabled={isTranscribingAudio}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/80 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <Brain className={`w-3.5 h-3.5 text-purple-600 ${isTranscribingAudio ? 'animate-spin' : ''}`} />
                        <span>{isTranscribingAudio ? 'Transcribing...' : 'Transcribe Audio'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {audioAttachment?.url && (
                  <div className="p-3 bg-slate-100/70 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold">
                        <Mic className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <audio 
                          src={currentAudioSrc || audioAttachment.url} 
                          controls 
                          className="w-full max-w-md h-9" 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {audioStatusMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${audioStatusMsg.includes('busy') || audioStatusMsg.includes('notice') || audioStatusMsg.includes('Notice') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                    {audioStatusMsg}
                  </div>
                )}
              </div>
            )}

            {/* Note Content Box - Text overflow & line wrap fix */}
            <div ref={contentBoxRef} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Note Content / Extracted Text</h3>
                {imageAttachment && cleanDisplayContent === '[Saved Image Node]' && (
                  <span className="text-[11px] font-semibold text-slate-400 italic">
                    Text not extracted yet. Click "Extract Text (OCR)" above.
                  </span>
                )}
                {note.type === 'voice' && cleanDisplayContent.includes('Live audio transcript ready for AI synthesis') && (
                  <span className="text-[11px] font-semibold text-purple-600 italic">
                    Click "Transcribe Audio" above to extract transcript.
                  </span>
                )}
              </div>
              <div className={`p-4 sm:p-5 rounded-2xl text-sm leading-relaxed font-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full transition-all ${
                activeTakeawayIdx !== null 
                  ? 'bg-purple-50/60 border-2 border-purple-300/80 text-purple-950 shadow-2xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-800'
              }`}>
                {cleanDisplayContent === '[Saved Image Node]' ? (
                  <span className="text-slate-500 italic">
                    Original image saved cleanly. Click <strong className="text-purple-700 font-bold">Extract Text (OCR)</strong> above whenever you want MemoFlow AI to analyze and extract text from this image.
                  </span>
                ) : cleanDisplayContent.includes('Live audio transcript ready for AI synthesis') ? (
                  <span className="text-slate-600">
                    {cleanDisplayContent}
                    <br /><br />
                    <span className="text-purple-700 font-semibold italic">
                      Click "Transcribe Audio" above to generate the full spoken transcript.
                    </span>
                  </span>
                ) : (
                  cleanDisplayContent
                )}
              </div>
            </div>

            {/* Attached Files Section */}
            {displayAttachments.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  <span>Attached Files ({displayAttachments.length})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayAttachments.map((att, idx) => {
                    const ext = att.name.split('.').pop()?.toLowerCase() || '';
                    const isImage = att.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);

                    return (
                      <button
                        key={att.id || idx}
                        type="button"
                        onClick={() => handleDownloadAttachment(att)}
                        disabled={downloadingAttId === (att.id || att.path || att.name)}
                        title={`Download ${att.name}`}
                        className="p-3.5 sm:p-4 bg-white hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer shadow-2xs hover:shadow-xs group w-full text-left disabled:opacity-60"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold">
                            {isImage ? <ImageIcon className="w-5 h-5" /> : <File className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-900 block truncate max-w-xs group-hover:text-purple-700">
                              {getCleanFilename(att.name)}
                            </span>
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                              {att.type.includes('pdf') ? 'PDF' : isImage ? 'IMAGE' : ext.toUpperCase()} • {att.sizeBytes ? `${(att.sizeBytes / 1024).toFixed(0)} KB` : 'Attached File'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-purple-600 text-slate-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                          <Download className={`w-4 h-4 ${downloadingAttId === (att.id || att.path || att.name) ? 'animate-bounce' : ''}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: MemoFlow AI Assistant - Responsive Width Alignment */}
        <div className="w-full lg:w-[420px] xl:w-[460px] border-t lg:border-t-0 lg:border-l border-slate-200/90 bg-white flex flex-col min-h-0 overflow-hidden shrink-0 shadow-xs">
          
          {/* AI Header & Navigation Tabs */}
          <div className="shrink-0">
            <div className="py-2.5 px-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="font-extrabold text-xs text-slate-900 block tracking-tight">
                    MemoFlow AI Assistant
                  </span>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200/80 bg-white">
              {[
                { id: 'chat', label: 'Ask MemoFlow', icon: Bot },
                { id: 'summary', label: 'AI Insights', icon: BookOpen },
                { id: 'tasks', label: 'Action Items', icon: CheckCircle },
                { id: 'quiz', label: 'Quiz', icon: HelpCircle },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = aiTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAiTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-2.5 px-1 text-[10px] sm:text-[11px] uppercase tracking-tight transition-all border-b-2 cursor-pointer ${
                      isActive 
                        ? 'border-purple-600 text-purple-700 bg-purple-50/60 font-extrabold' 
                        : 'border-transparent text-slate-500 hover:text-slate-900 font-bold'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Tab Viewport - Enhanced Scrollable Layout */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            
            {/* Tab 1: Ask MemoFlow Assistant */}
            {aiTab === 'chat' && (
              <div className="space-y-4 flex flex-col h-full justify-between">
                <div className="space-y-3 overflow-y-auto min-h-[280px] pr-1">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3.5 rounded-2xl text-xs max-w-[88%] font-medium leading-relaxed shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white rounded-br-none font-bold'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80'
                      }`}>
                        {msg.sender === 'user' ? msg.text : renderFormattedMessage(msg.text)}
                      </div>
                    </div>
                  ))}
                  {isAiThinking && (
                    <div className="flex items-center gap-2 text-xs text-purple-600 font-bold py-2">
                      <Brain className="w-4 h-4 text-purple-600 animate-pulse" />
                      <span>MemoFlow AI is thinking…</span>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendChat} className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask MemoFlow AI about this note..."
                      className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-purple-500/20 focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-2xl text-xs text-slate-800 placeholder-slate-400 font-medium transition-all focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isAiThinking}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: AI Summary & Key Takeaways */}
            {aiTab === 'summary' && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">AI Executive Summary</h4>
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                      <Brain className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                      <span>{isSummarizing ? 'Generating Summary...' : 'Summarize with AI'}</span>
                    </button>
                  </div>
                  <div className="p-4 bg-white border border-purple-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed font-medium shadow-xs hover:shadow-sm transition-all">
                    {hasRealSummary 
                      ? note.summary 
                      : (note.summary || `Click "Summarize with AI" to generate an executive summary for this document.`)}
                  </div>
                  {summaryStatusMsg && (
                    <div className={`p-3 rounded-xl text-xs font-semibold ${summaryStatusMsg.includes('busy') || summaryStatusMsg.includes('notice') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                      {summaryStatusMsg}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Key Concept Takeaways</h4>
                  <div className="space-y-2.5">
                    {(hasRealTakeaways ? note.takeaways : [
                      `Document title: "${note.title}".`,
                      `Categorized under ${note.category || 'Personal'} workspace context.`
                    ]).map((point, i) => (
                      <div 
                        key={i} 
                        onClick={() => handleTakeawayClick(i)}
                        className={`flex items-start gap-2.5 text-xs p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-sm ${
                          activeTakeawayIdx === i 
                            ? 'bg-purple-100/80 border-purple-300 text-purple-950 font-bold' 
                            : 'bg-white text-slate-700 border-slate-200/90 hover:bg-purple-50/40'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Action Checklist */}
            {aiTab === 'tasks' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Action Items</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                      {note.tasks.filter(t => t.completed).length} / {note.tasks.length} Done
                    </span>
                    <button
                      type="button"
                      onClick={handleExtractTasks}
                      disabled={isExtractingTasks}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ListTodo className={`w-3.5 h-3.5 ${isExtractingTasks ? 'animate-spin' : ''}`} />
                      <span>{isExtractingTasks ? 'Detecting...' : 'Detect Tasks'}</span>
                    </button>
                  </div>
                </div>

                {tasksStatusMsg && (
                  <div className="p-2.5 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold">
                    {tasksStatusMsg}
                  </div>
                )}

                {note.tasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic bg-white rounded-2xl border border-slate-200/90 space-y-3 shadow-xs">
                    <p>No action items detected for this document yet.</p>
                    <button
                      onClick={handleExtractTasks}
                      className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>Extract Action Items with AI</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {note.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task.id)}
                        className={`p-4 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer shadow-xs hover:shadow-sm ${
                          task.completed 
                            ? 'bg-emerald-50/50 border-emerald-200 text-slate-500' 
                            : 'bg-white border-slate-200/90 text-slate-800 hover:border-purple-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          task.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {task.completed && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className={`text-xs font-semibold ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Interactive MCQ Quiz */}
            {aiTab === 'quiz' && (
              <div className="space-y-5">
                
                {/* 1. Quiz Controls Card */}
                <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-xs hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-black text-slate-900">Quiz Controls</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">Generate a quiz from extracted content</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Number of Questions</label>
                      <select 
                        value={quizNumQuestions}
                        onChange={(e) => setQuizNumQuestions(parseInt(e.target.value) || 5)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value={5}>5</option>
                        <option value={3}>3</option>
                        <option value={10}>10</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Difficulty Level</label>
                      <select 
                        value={quizDifficulty}
                        onChange={(e) => setQuizDifficulty(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        <option value="medium">Medium</option>
                        <option value="easy">Easy</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-90 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Brain className={`w-4 h-4 ${isGeneratingQuiz ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingQuiz ? 'Generating Quiz...' : 'Generate Quiz'}</span>
                  </button>
                </div>

                {quizStatusMsg && (
                  <div className="p-3 rounded-2xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold shadow-xs">
                    {quizStatusMsg}
                  </div>
                )}

                {!activeQuiz || activeQuiz.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <p>No quiz questions generated for this document yet. Configure settings above and click Generate Quiz to start.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* 2. Questions List */}
                    {activeQuiz.map((q, qIdx) => {
                      const isSubmitted = quizScore !== null;
                      const optionLetters = ['A', 'B', 'C', 'D'];

                      return (
                        <div key={q.id} className="space-y-3 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider block">
                              QUESTION {qIdx + 1} OF {activeQuiz.length}
                            </span>
                            {isSubmitted && selectedAnswers[q.id] === q.correctAnswer && (
                              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                                ✓ Correct
                              </span>
                            )}
                            {isSubmitted && selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== q.correctAnswer && (
                              <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-md">
                                ✗ Incorrect
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-extrabold text-slate-900 leading-snug">{q.question}</p>

                          <div className="space-y-2 pt-1">
                            {q.options.map((option, optIdx) => {
                              const isSelected = selectedAnswers[q.id] === optIdx;
                              const isCorrectOpt = q.correctAnswer === optIdx;

                              let btnStyle = 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
                              if (isSubmitted) {
                                if (isCorrectOpt) {
                                  btnStyle = 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold shadow-2xs ring-1 ring-emerald-300';
                                } else if (isSelected && !isCorrectOpt) {
                                  btnStyle = 'bg-rose-50 text-rose-950 border-rose-300 font-bold shadow-2xs';
                                } else {
                                  btnStyle = 'bg-white text-slate-400 border-slate-200 opacity-60';
                                }
                              } else if (isSelected) {
                                btnStyle = 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs';
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleSelectQuizOption(q.id, optIdx)}
                                  disabled={isSubmitted}
                                  className={`w-full p-2.5 rounded-xl text-xs text-left font-medium transition-all flex items-center justify-between border cursor-pointer ${btnStyle}`}
                                >
                                  <div className="flex items-center gap-2.5 pr-2">
                                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                      isSelected ? 'bg-purple-200 text-purple-900' : 'bg-slate-200/80 text-slate-700'
                                    }`}>
                                      {optionLetters[optIdx] || optIdx + 1}
                                    </span>
                                    <span className="leading-snug">{option}</span>
                                  </div>

                                  {isSubmitted && isCorrectOpt && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                                      <Check className="w-3 h-3" /> Correct
                                    </span>
                                  )}
                                  {isSubmitted && isSelected && !isCorrectOpt && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-extrabold bg-rose-100 px-2 py-0.5 rounded-md shrink-0">
                                      <X className="w-3 h-3" /> Your Choice
                                    </span>
                                  )}
                                  {!isSubmitted && isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>

                          {/* Evaluation callout after submission */}
                          {isSubmitted && (
                            <div className="mt-3 p-3 rounded-xl bg-purple-50/80 border border-purple-200/80 text-purple-950 text-xs leading-relaxed space-y-1">
                              <div className="flex items-center gap-2 font-extrabold text-[11px]">
                                <span>Your Answer: {selectedAnswers[q.id] !== undefined ? optionLetters[selectedAnswers[q.id]] : 'None'}</span>
                                {selectedAnswers[q.id] === q.correctAnswer ? (
                                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Correct</span>
                                ) : (
                                  <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">Incorrect</span>
                                )}
                              </div>
                              {(q as any).explanation && (
                                <p className="font-medium text-slate-700 pt-0.5">
                                  <strong className="text-purple-900 font-bold">Explanation:</strong> {(q as any).explanation}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 3. Quiz Summary Card (Visible when evaluated) */}
                    {quizScore !== null && (
                      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl space-y-3 shadow-xs hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-black text-slate-900">📊 Quiz Summary</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Evaluated
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <span className="text-[10px] font-bold text-emerald-700 block">Correct</span>
                            <span className="text-base font-black text-emerald-900">{quizScore}</span>
                          </div>
                          <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl">
                            <span className="text-[10px] font-bold text-rose-700 block">Incorrect</span>
                            <span className="text-base font-black text-rose-900">{activeQuiz.length - quizScore}</span>
                          </div>
                          <div className="p-2 bg-purple-50 border border-purple-100 rounded-xl">
                            <span className="text-[10px] font-bold text-purple-700 block">Total</span>
                            <span className="text-base font-black text-purple-900">{activeQuiz.length}</span>
                          </div>
                          <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl">
                            <span className="text-[10px] font-bold text-amber-700 block">Score</span>
                            <span className="text-base font-black text-amber-900">{Math.round((quizScore / activeQuiz.length) * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Bottom Action Row - Clean Buttons without extra emoji icons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleEvaluateQuiz}
                        disabled={quizScore !== null}
                        className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          quizScore !== null
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-black opacity-90'
                            : 'bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-90 text-white'
                        }`}
                      >
                        {quizScore !== null ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-emerald-700" />
                            <span>Submitted ({quizScore}/{activeQuiz.length})</span>
                          </>
                        ) : (
                          <span>Submit Quiz</span>
                        )}
                      </button>

                      <button
                        onClick={handleGenerateQuiz}
                        disabled={isGeneratingQuiz}
                        className="px-4 py-3 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Generate a new set of quiz questions using AI"
                      >
                        <Brain className={`w-4 h-4 ${isGeneratingQuiz ? 'animate-spin' : ''}`} />
                        <span className="inline font-bold">{isGeneratingQuiz ? 'Generating...' : 'Retake Quiz'}</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
