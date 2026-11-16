'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, History, Volume2, Sparkles, Bot, FileText } from 'lucide-react';
import Floating3DOrb from './Floating3DOrb';
import { Note } from '../mockData';

interface VoiceAssistantProps {
  notes?: Note[];
  compact?: boolean;
  activeNote?: Note | null;
}

/**
 * Lightweight inline markdown parser for bold, inline code, and italics
 */
function parseInline(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-purple-700 font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <em key={i} className="italic text-slate-800">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}

/**
 * Robust markdown block parser: handles headings, lists, code blocks, and paragraphs
 */
function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed select-text cursor-text">{content}</div>;
  }

  const lines = content.split(/\r?\n/);
  const blocks: Array<
    | { type: 'h1' | 'h2' | 'h3'; text: string }
    | { type: 'bullet-list'; items: string[] }
    | { type: 'numbered-list'; items: string[] }
    | { type: 'code-block'; lang: string; code: string }
    | { type: 'paragraph'; text: string }
  > = [];

  let currentBulletList: string[] | null = null;
  let currentNumberedList: string[] | null = null;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', text: currentParagraph.join(' ') });
      currentParagraph = [];
    }
  };

  const flushLists = () => {
    if (currentBulletList) {
      blocks.push({ type: 'bullet-list', items: currentBulletList });
      currentBulletList = null;
    }
    if (currentNumberedList) {
      blocks.push({ type: 'numbered-list', items: currentNumberedList });
      currentNumberedList = null;
    }
  };

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushParagraph();
        flushLists();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
      } else {
        inCodeBlock = false;
        blocks.push({ type: 'code-block', lang: codeBlockLang, code: codeBlockLines.join('\n') });
        codeBlockLang = '';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'h1', text: trimmed.slice(2) });
      continue;
    }

    // Bullet lists (*, -, •)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (currentNumberedList) flushLists();
      if (!currentBulletList) currentBulletList = [];
      currentBulletList.push(bulletMatch[1]);
      continue;
    }

    // Numbered lists (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      if (currentBulletList) flushLists();
      if (!currentNumberedList) currentNumberedList = [];
      currentNumberedList.push(numberedMatch[2]);
      continue;
    }

    // Regular line
    flushLists();
    currentParagraph.push(trimmed);
  }

  if (inCodeBlock) {
    blocks.push({ type: 'code-block', lang: codeBlockLang, code: codeBlockLines.join('\n') });
  }
  flushParagraph();
  flushLists();

  return (
    <div className="space-y-2.5 text-xs leading-relaxed break-words select-text cursor-text">
      {blocks.map((block, idx) => {
        if (block.type === 'code-block') {
          return (
            <div key={idx} className="my-2 rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto select-text border border-slate-800 shadow-xs">
              {block.lang && (
                <div className="text-[10px] text-slate-400 font-sans uppercase font-bold mb-1 pb-1 border-b border-slate-800">
                  {block.lang}
                </div>
              )}
              <pre className="whitespace-pre overflow-x-auto leading-relaxed">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }
        if (block.type === 'h1' || block.type === 'h2') {
          return (
            <h4 key={idx} className="font-bold text-slate-900 text-[13px] mt-3.5 first:mt-0 tracking-tight select-text">
              {parseInline(block.text)}
            </h4>
          );
        }
        if (block.type === 'h3') {
          return (
            <h5 key={idx} className="font-bold text-slate-900 text-xs mt-3 first:mt-0 tracking-tight select-text">
              {parseInline(block.text)}
            </h5>
          );
        }
        if (block.type === 'bullet-list') {
          return (
            <ul key={idx} className="space-y-1.5 my-2 pl-0.5 select-text">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-slate-700 select-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                  <span className="flex-1 leading-relaxed">{parseInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'numbered-list') {
          return (
            <ol key={idx} className="space-y-1.5 my-2 pl-0.5 select-text">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx} className="flex items-start gap-2 text-slate-700 select-text">
                  <span className="font-bold text-purple-600 text-[11px] shrink-0 min-w-[14px]">
                    {itemIdx + 1}.
                  </span>
                  <span className="flex-1 leading-relaxed">{parseInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx} className="text-slate-700 leading-relaxed select-text">
            {parseInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

export default function VoiceAssistant({ notes = [], compact = false, activeNote = null }: VoiceAssistantProps) {
  const [orbState, setOrbState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; citations?: string[] }>>([
    { sender: 'ai', text: 'Hello! I am MemoFlow Assistant. Ask me anything — about your saved memories or anything else.' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendingRef = useRef(false);

  const suggestedPrompts = [
    'What memories do I have saved?',
    'Find my notes containing tasks',
    'Summarize my recent uploads',
    'What collections do I have?',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleSendText = async (text: string) => {
    if (!text.trim() || sendingRef.current) return;
    sendingRef.current = true;

    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInputText('');
    setOrbState('thinking');

    try {
      const imageAttachment = activeNote?.attachments?.find(a => a.type?.startsWith('image/'));
      let imageBase64: string | undefined = undefined;
      let imageMime: string | undefined = undefined;

      if (imageAttachment?.url?.startsWith('data:image/')) {
        const parts = imageAttachment.url.split(';base64,');
        imageMime = parts[0].replace('data:', '');
        imageBase64 = parts[1];
      }

      // Prepare lightweight context notes: strip out large binary attachments to keep payload small & fast
      const compactNotes = (notes || []).map(n => ({
        id: n.id,
        title: n.title,
        type: n.type,
        category: n.category,
        summary: n.summary,
        content: n.content ? n.content.substring(0, 500) : '',
        tags: n.tags,
        savedDate: n.savedDate
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          notes: compactNotes,
          imageBase64,
          imageMime,
          activeNote: activeNote ? {
            title: activeNote.title,
            content: activeNote.content,
            type: activeNote.type,
            summary: activeNote.summary,
            imageBase64,
            imageMime
          } : undefined
        })
      });

      const data = await res.json();
      const aiText = data.answer || "I'm sorry, I couldn't process your request right now.";
      const citations = data.citations || [];

      setOrbState('speaking');
      setMessages(prev => [...prev, { sender: 'ai', text: aiText, citations }]);

      setTimeout(() => {
        setOrbState('idle');
      }, 3500);
    } catch (err) {
      console.error('Chat API Error:', err);
      setOrbState('speaking');
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `I encountered an issue connecting to the AI server. However, you currently have ${notes.length} saved memory nodes in your workspace context.`,
          citations: notes.slice(0, 1).map(n => n.title)
        }
      ]);
      setTimeout(() => {
        setOrbState('idle');
      }, 3500);
    } finally {
      sendingRef.current = false;
    }
  };

  const startListening = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setOrbState('speaking');
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: "Voice input is not supported in this browser. Please use the text input below to chat with Memo AI." }
      ]);
      setTimeout(() => setOrbState('idle'), 3500);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setOrbState('listening');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript && transcript.trim()) {
          handleSendText(transcript.trim());
        } else {
          setOrbState('idle');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event error:', event?.error);
        if (event?.error === 'not-allowed') {
          setOrbState('speaking');
          setMessages(prev => [
            ...prev,
            { sender: 'ai', text: "Microphone permission was denied. Please allow microphone access in your browser settings to use voice input." }
          ]);
          setTimeout(() => setOrbState('idle'), 3500);
        } else {
          setOrbState('idle');
        }
      };

      recognition.onend = () => {
        setOrbState(prev => (prev === 'listening' ? 'idle' : prev));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setOrbState('idle');
    }
  };

  const handleVoiceTrigger = () => {
    if (orbState === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setOrbState('idle');
    } else if (orbState === 'idle') {
      startListening();
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col h-full bg-slate-50/90 border-l border-slate-200/80 text-slate-900 overflow-hidden backdrop-blur-xl font-sans select-text">
        {/* Compact AI Assistant Header */}
        <div className="px-4 py-3 bg-white/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-xs text-slate-900 tracking-tight">
              MemoFlow Assistant
            </span>
          </div>
          <button
            type="button"
            onClick={handleVoiceTrigger}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-200/60 text-[10px] font-bold text-purple-700 transition-colors cursor-pointer"
            title="Voice Assistant"
          >
            <Mic className={`w-3 h-3 ${orbState === 'listening' ? 'text-emerald-500 animate-pulse' : 'text-purple-600'}`} />
            <span className="capitalize">{orbState === 'idle' ? 'Voice' : orbState}</span>
          </button>
        </div>

        {/* Messages transcript list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 bg-white/50 select-text">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} select-text`}>
              <div className={`p-3.5 rounded-2xl text-xs max-w-[90%] font-normal leading-relaxed select-text cursor-text ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white rounded-br-xs shadow-2xs'
                  : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-2xs'
              }`}>
                <FormattedMessage content={msg.text} isUser={msg.sender === 'user'} />
              </div>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 select-text">
                  {msg.citations.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-[9px] font-bold text-purple-700 border border-purple-200 select-text">
                      <FileText className="w-2.5 h-2.5" />
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Compact Prompt Input */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendText(inputText); }} className="p-3 border-t border-slate-200/80 bg-white shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Memo AI..."
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all select-text cursor-text"
            />
            <button type="submit" disabled={!inputText.trim()} className="absolute right-2 p-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-90 disabled:opacity-40 text-white rounded-xl transition-colors cursor-pointer shadow-2xs disabled:cursor-not-allowed">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col lg:flex-row h-full bg-slate-50/90 text-slate-900 font-sans">
      
      {/* Voice Canvas Pane (Left) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-slate-200/80 relative overflow-y-auto bg-gradient-to-b from-slate-50/80 to-slate-100/40">
        
        <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center my-auto py-4">
          {/* Sleek Minimalist Glowing AI Orb (Primary Visual Focus) */}
          <div className="p-6 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-xl shadow-purple-500/15 mb-6">
            <div className="relative w-28 h-28 flex items-center justify-center select-none shrink-0">
              <div 
                onClick={handleVoiceTrigger} 
                className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 via-purple-600 to-cyan-500 flex items-center justify-center select-none cursor-pointer shadow-[0_0_35px_rgba(124,58,237,0.4)] hover:scale-105 active:scale-95 transition-all group"
                title={orbState === 'listening' ? 'Click to stop listening' : 'Click to speak'}
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <Bot className="w-9 h-9 text-white animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Indicator Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs mb-8 shrink-0 select-none">
            <Mic className={`w-3.5 h-3.5 ${orbState === 'listening' ? 'text-emerald-500 animate-pulse' : 'text-purple-600'}`} />
            <span className="capitalize">
              {orbState === 'idle' && 'Click Orb to Speak'}
              {orbState === 'listening' && 'Listening... (Speak now)'}
              {orbState === 'thinking' && 'Searching Memory Graph...'}
              {orbState === 'speaking' && 'Speaking Answer...'}
            </span>
          </div>

          {/* Suggested Prompts Grid */}
          <div className="w-full max-w-lg space-y-2.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Suggested Prompts
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSendText(prompt)}
                  className="p-3.5 bg-white hover:bg-purple-50/60 hover:border-purple-300/80 border border-slate-200/80 text-left rounded-2xl text-xs font-semibold text-slate-700 hover:text-purple-900 transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Transcript Log Pane (Right Side Anchored Panel) */}
      <div className="w-full lg:w-[470px] xl:w-[480px] flex flex-col justify-between bg-white h-full border-t lg:border-t-0 shrink-0 border-l border-slate-200/80 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10 select-text">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-slate-900">Transcript & Chat</h3>
              <p className="text-[10px] text-slate-400">Contextual Memory AI</p>
            </div>
          </div>
          <span className="text-[9px] uppercase font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/70">
            Active
          </span>
        </div>

        {/* Messages transcript list */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 min-h-0 select-text bg-[#FAFBFD]">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} select-text`}
            >
              <div
                className={`px-4 py-3 rounded-2xl text-xs font-normal leading-relaxed select-text cursor-text ${
                  msg.sender === 'user'
                    ? 'max-w-[85%] bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 text-white rounded-br-xs shadow-2xs'
                    : 'max-w-[94%] bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-2xs'
                }`}
              >
                <FormattedMessage content={msg.text} isUser={msg.sender === 'user'} />
              </div>
              
              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1 select-text">
                  {msg.citations.map((citation, cIdx) => (
                    <span 
                      key={cIdx}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-[10px] font-bold text-purple-700 border border-purple-200/70 select-text"
                    >
                      <FileText className="w-3 h-3 text-purple-500" />
                      {citation}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendText(inputText);
          }}
          className="p-3.5 border-t border-slate-100 bg-white flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask Memo AI..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all select-text cursor-text"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-90 disabled:opacity-40 text-white rounded-2xl transition-all cursor-pointer shadow-2xs disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
