'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Camera, Mic, Link as LinkIcon, Sparkles, Folder, 
  CheckSquare, Clock, ArrowRight, Check, Pin, HardDrive, Plus, Compass, Paperclip
} from 'lucide-react';
import { Note, Collection } from '../mockData';
import { isNoteInCollection } from '@/lib/services/collectionsService';

interface DashboardHomeProps {
  notes: Note[];
  collections: Collection[];
  allNotes?: Note[];
  onSelectNote: (noteId: string) => void;
  onOpenQuickCapture: (preselectedType?: string) => void;
  onTriggerSearch: () => void;
  onUpdateNote: (updatedNote: Note) => void;
  user?: { name: string; email: string } | null;
  loading?: boolean;
}

export default function DashboardHome({ 
  notes, 
  collections, 
  allNotes,
  onSelectNote, 
  onOpenQuickCapture,
  onTriggerSearch,
  onUpdateNote,
  user,
  loading = false
}: DashboardHomeProps) {
  const userName = user?.name || 'User';
  const pinnedNotes = notes.filter(n => n.pinned);
  const recentNotes = notes.filter(n => !n.pinned).slice(0, 6);
  const notesForCollections = allNotes || notes;

  // Extract real tasks from real notes state
  const extractedTasks = notes.flatMap(n => 
    n.tasks.map(t => ({ ...t, noteTitle: n.title, noteId: n.id }))
  );

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'University': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'Personal': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Office': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Research': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'Projects': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Finance': return 'text-cyan-700 bg-cyan-50 border-cyan-200';
      case 'Travel': return 'text-teal-700 bg-teal-50 border-teal-200';
      default: return 'text-violet-700 bg-violet-50 border-violet-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 font-sans">
      
      {/* 1. Dashboard Welcome Card (Compact, Refined Header) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 relative overflow-hidden shadow-xs hover:border-slate-300 transition-all duration-150">
        {/* Subtle Brand Ambient Lighting Glows */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-tr from-violet-500/10 via-purple-500/10 to-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-blue-400/5 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              Welcome back,{' '}
              {loading ? (
                <span className="inline-block w-32 h-8 bg-slate-100 rounded-lg animate-pulse border border-slate-200" />
              ) : (
                <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
                  {userName}
                </span>
              )}
            </h1>
            
            <p className="text-slate-500 text-xs sm:text-sm font-medium">
              Capture, search, and synthesize your thoughts and research notes.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenQuickCapture('note')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Note</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Capture Action Bar (Refined & Compact) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Quick Capture
          </span>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Universal ingestion dropzone
          </span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          {[
            { label: 'New Note', type: 'note', icon: FileText, badgeColor: 'bg-purple-50 text-purple-600 border-purple-200/80', desc: 'Markdown & text' },
            { label: 'Upload File', type: 'pdf', icon: HardDrive, badgeColor: 'bg-indigo-50 text-indigo-600 border-indigo-200/80', desc: 'PDFs & Docs' },
            { label: 'Voice Note', type: 'voice', icon: Mic, badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200/80', desc: 'Audio recording' },
            { label: 'Paste Link', type: 'link', icon: LinkIcon, badgeColor: 'bg-cyan-50 text-cyan-600 border-cyan-200/80', desc: 'Web articles' },
            { label: 'Scan Image', type: 'screenshot', icon: Camera, badgeColor: 'bg-violet-50 text-violet-600 border-violet-200/80', desc: 'OCR snapshot' },
          ].map((action) => {
            const IconComponent = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onOpenQuickCapture(action.type)}
                className="p-3 sm:p-3.5 bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98] cursor-pointer shadow-xs group text-slate-800 text-center"
              >
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-150 border ${action.badgeColor} shadow-2xs group-hover:scale-105`}>
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-violet-700 transition-colors block leading-tight">
                    {action.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium hidden sm:block mt-0.5">
                    {action.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Empty State or AI Memory Resurfacing */}
      {notes.length === 0 ? (
        <section className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-2xs space-y-4 text-slate-900">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-extrabold text-slate-900">No memories yet.</h2>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Upload your first document, voice memo, URL, or screenshot to start building your searchable AI memory.
            </p>
          </div>
          <div className="pt-1">
            <button
              onClick={() => onOpenQuickCapture()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Save First Memory
            </button>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Activity Column (Enhanced Prominence) */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-violet-600 fill-current" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Pinned Memories
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pinnedNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => onSelectNote(note.id)}
                      className="bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between group space-y-3 text-slate-800"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/80">
                              {note.type}
                            </span>
                            {note.category && (
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${getCategoryBadgeClass(note.category)}`}>
                                {note.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">{note.savedDate}</span>
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-1">
                          {note.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {note.summary || note.content}
                        </p>
                      </div>

                      {note.attachments && note.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50/80 px-2 py-0.5 rounded-md border border-violet-200/80 w-fit">
                          <Paperclip className="w-3 h-3 text-violet-600" />
                          <span>{note.attachments.length} attachment{note.attachments.length > 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Saved Activity (Primary Main Section) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Recently Saved Activity
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {notes.length} total memor{notes.length === 1 ? 'y' : 'ies'}
                </span>
              </div>

              <div className="space-y-2.5">
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onSelectNote(note.id)}
                    className="bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-3.5 sm:p-4 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 sm:gap-4 group text-slate-800"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200/80 shrink-0 font-bold text-xs group-hover:scale-105 transition-transform duration-150 shadow-2xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-violet-700 transition-colors truncate">
                            {note.title}
                          </h4>
                          {note.category && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border shrink-0 ${getCategoryBadgeClass(note.category)}`}>
                              {note.category}
                            </span>
                          )}
                          {note.attachments && note.attachments.length > 0 && (
                            <Paperclip className="w-3 h-3 text-violet-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate leading-normal mt-0.5">
                          {note.summary || note.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold text-slate-400">{note.savedDate}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all duration-150" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Collections & Tasks (Compact Supporting Cards) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Active Collections */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 text-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Collections</span>
                <span className="text-xs text-violet-700 font-bold bg-violet-50 border border-violet-200/70 px-2 py-0.5 rounded-full">{collections.length} Total</span>
              </div>

              {collections.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400 italic">
                  No collections created yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.slice(0, 4).map((col) => {
                    const count = notesForCollections.filter((n) => isNoteInCollection(n, col)).length;
                    return (
                      <div key={col.id} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-150 flex items-center justify-between group/col">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                          <span className="text-xs font-bold text-slate-800 group-hover/col:text-violet-900 transition-colors">{col.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 group-hover/col:text-violet-700 transition-colors">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Extracted Tasks */}
            {extractedTasks.length > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 text-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action Items</span>
                  <span className="text-xs text-violet-700 font-bold bg-violet-50 border border-violet-200/70 px-2 py-0.5 rounded-full">{extractedTasks.length} Tasks</span>
                </div>

                <div className="space-y-2">
                  {extractedTasks.slice(0, 4).map((task) => (
                    <div key={task.id} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-violet-300 transition-all duration-150 flex items-start gap-2.5 text-xs text-slate-700 font-medium">
                      <CheckSquare className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-[11px] leading-tight">{task.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
