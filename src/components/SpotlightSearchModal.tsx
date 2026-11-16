'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, X, Sparkles, Command, AlertCircle } from 'lucide-react';
import { Note } from '../mockData';

interface SpotlightSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onSelectNote: (noteId: string) => void;
}

export default function SpotlightSearchModal({ isOpen, onClose, notes, onSelectNote }: SpotlightSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const matches = notes.filter(note =>
      note.title.toLowerCase().includes(query.toLowerCase()) ||
      note.summary.toLowerCase().includes(query.toLowerCase()) ||
      note.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
    );
    setResults(matches);
  }, [query, notes]);

  // Handle outside click or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm font-sans">
      <div 
        ref={modalRef}
        className="w-full max-w-2xl bg-white border border-memoborder rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sans"
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-memoborder px-4 py-4">
          <Search className="w-5 h-5 text-memotextsec mr-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your neural memory (e.g. 'React concurrent' or 'AI Prompting')..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-memotext focus:outline-none"
          />
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-50 text-memotextsec transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Suggestions/Results body */}
        <div className="p-4 max-h-[300px] overflow-y-auto no-scrollbar bg-slate-50/30">
          {query ? (
            results.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-memotextsec uppercase px-2">Memory Match Nodes</span>
                {results.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      onSelectNote(note.id);
                      onClose();
                    }}
                    className="p-3 bg-white border border-memoborder rounded-xl flex items-center justify-between text-xs hover:border-memoprimary hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-memoprimary shrink-0" />
                      <span className="font-bold text-memotext">{note.title}</span>
                    </div>
                    <span className="text-[9px] font-semibold text-memotextsec uppercase bg-slate-100 px-2 py-0.5 rounded">
                      #{note.collection}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-xs text-memotextsec space-y-1">
                <AlertCircle className="w-5 h-5 text-slate-300 mx-auto" />
                <p>No memories match your query term.</p>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {/* Keyboard Help */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold text-memotextsec uppercase">Key Shortcuts</span>
                <div className="flex items-center gap-1 text-[10px] text-memotextsec bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  <Command className="w-3 h-3" />
                  <span>Esc to exit</span>
                </div>
              </div>

              {/* Sample suggestion tags */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-memotextsec uppercase px-1">Suggested searches</span>
                <div className="flex flex-wrap gap-2">
                  {['React Concurrent', 'Chain of Thought', 'Marketing Internships', 'ADHD concept notes'].map(term => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      className="px-3 py-1.5 bg-white border border-memoborder text-xs font-semibold text-memotext hover:border-memoprimary hover:text-memoprimary hover:bg-blue-50/20 rounded-xl transition-all cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


