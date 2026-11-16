'use client';

import React, { useState } from 'react';
import { 
  Grid, List, Calendar, Search, SlidersHorizontal, ArrowUpDown, 
  FileText, Camera, Mic, MessageSquare, Sparkles, Link as LinkIcon, Star, Pin, Tag, Plus, Compass, Paperclip, ChevronRight, Layers
} from 'lucide-react';
import { Youtube } from './BrandIcons';
import { Note, Collection } from '../mockData';
import { isNoteInCollection } from '@/lib/services/collectionsService';

interface LibraryViewProps {
  notes: Note[];
  collections: Collection[];
  onSelectNote: (noteId: string) => void;
  onToggleFavorite: (noteId: string) => void;
  onOpenQuickCapture?: () => void;
  title?: string;
  subtitle?: string;
}

export default function LibraryView({ 
  notes, 
  collections, 
  onSelectNote, 
  onToggleFavorite, 
  onOpenQuickCapture,
  title = "All Memories",
  subtitle = "Browse, filter, and search through all your saved knowledge."
}: LibraryViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'updated' | 'oldest' | 'title-asc' | 'title-desc'>('newest');

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).filter(Boolean);

  // Normalized, trimmed search query
  const trimmedQuery = searchQuery.trim().toLowerCase();

  // Filter & Sort logic
  const filteredNotes = notes
    .filter(note => {
      const titleClean = (note.title || '').toLowerCase();
      const summaryClean = (note.summary || '').toLowerCase();
      const contentClean = (note.content || '').toLowerCase();
      const colClean = (note.collection || '').toLowerCase();
      const catClean = (note.category || '').toLowerCase();

      const matchSearch = !trimmedQuery || 
        titleClean.includes(trimmedQuery) || 
        summaryClean.includes(trimmedQuery) ||
        contentClean.includes(trimmedQuery) ||
        colClean.includes(trimmedQuery) ||
        catClean.includes(trimmedQuery) ||
        (note.tags && note.tags.some(tag => (tag || '').toLowerCase().includes(trimmedQuery))) ||
        (note.takeaways && note.takeaways.some(t => (t || '').toLowerCase().includes(trimmedQuery))) ||
        (note.attachments && note.attachments.some(att => (att.name || '').toLowerCase().includes(trimmedQuery)));
      
      const noteType = note.type as string;
      const matchType = selectedType === 'all' || 
        (selectedType === 'images' ? (noteType === 'screenshot' || noteType === 'image') :
         selectedType === 'ocr' ? (noteType === 'ocr' || contentClean.includes('ocr')) :
         selectedType === 'docx' ? (noteType === 'docx' || ((note.originalUrl || '').toLowerCase().endsWith('.docx'))) :
         noteType === selectedType);

      const matchCollection = selectedCollection === 'all' || isNoteInCollection(note, selectedCollection);
      const matchTag = selectedTag === 'all' || (note.tags && note.tags.some(t => (t || '').toLowerCase() === selectedTag.toLowerCase()));

      return matchSearch && matchType && matchCollection && matchTag;
    })
    .sort((a, b) => {
      if (sortBy === 'newest' || sortBy === 'updated') return new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime();
      if (sortBy === 'oldest') return new Date(a.savedDate).getTime() - new Date(b.savedDate).getTime();
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
      if (sortBy === 'title-desc') return b.title.localeCompare(a.title);
      return 0;
    });

  const getIcon = (type: string) => {
    switch (type) {
      case 'note': return FileText;
      case 'screenshot': return Camera;
      case 'pdf': return FileText;
      case 'voice': return Mic;
      case 'youtube': return Youtube;
      case 'chatgpt': return Sparkles;
      case 'whatsapp': return MessageSquare;
      default: return LinkIcon;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'note': return 'text-violet-600 bg-violet-50 border-violet-100';
      case 'screenshot': return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'pdf': return 'text-red-600 bg-red-50 border-red-100';
      case 'voice': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'youtube': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-indigo-600 bg-indigo-50 border-indigo-100';
    }
  };

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      
      {/* Title & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {title} ({filteredNotes.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {subtitle}
          </p>
        </div>

        {/* View mode toggle & Quick Action */}
        <div className="flex items-center gap-2.5 self-start">
          <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-violet-600 text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Grid View (3 columns)"
              aria-label="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-violet-600 text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              title="List View"
              aria-label="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer ${viewMode === 'timeline' ? 'bg-violet-600 text-white shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
              title="Timeline View"
              aria-label="Timeline View"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          {onOpenQuickCapture && (
            <button
              onClick={onOpenQuickCapture}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Note
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar (Compact & Clean) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
        
        {/* Search */}
        <div className="relative flex items-center flex-1 max-w-md">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories, title, content, or context..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Dropdown Filters (Search, All Formats, All Collections, Recently Added) */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Format Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="all">All Formats</option>
              <option value="note">Notes</option>
              <option value="pdf">PDFs</option>
              <option value="docx">DOCX</option>
              <option value="images">Images / Screenshots</option>
              <option value="voice">Voice Notes</option>
              <option value="ocr">OCR / Extracted Text</option>
              <option value="youtube">YouTube</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          {/* Collection Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="all">All Collections</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown (Repositioned naturally into the toolbar) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
            >
              <option value="newest">Recently Added</option>
              <option value="updated">Recently Updated</option>
              <option value="oldest">Oldest First</option>
              <option value="title-asc">A–Z</option>
              <option value="title-desc">Z–A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Rendering */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              {notes.length === 0 ? 'No memories yet' : 'No memories match your filters'}
            </h3>
            <p className="text-xs text-slate-500 font-normal">
              {notes.length === 0 
                ? 'Save your first memory using the + New Note button or quick capture.' 
                : 'Try adjusting your search query, format filter, or collection selection.'}
            </p>
          </div>
          {onOpenQuickCapture && (
            <button
              onClick={onOpenQuickCapture}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Save Your First Memory
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredNotes.map((note) => {
            const IconComponent = getIcon(note.type);
            const colorClass = getTypeColor(note.type);
            const categoryBadgeClass = getCategoryBadgeClass(note.category);

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${colorClass}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 group-hover:text-violet-700 transition-colors truncate">
                        {note.title}
                      </h4>
                      {note.category && (
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border shrink-0 ${categoryBadgeClass}`}>
                          {note.category}
                        </span>
                      )}
                      {note.attachments && note.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                          <Paperclip className="w-3 h-3 text-violet-600" />
                          {note.attachments.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate font-normal">
                      {note.summary || note.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400 font-medium">
                  <span className="hidden sm:inline-block">{note.savedDate}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(note.id);
                    }}
                    className="p-1 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Pin className={`w-4 h-4 ${note.pinned ? 'text-amber-400 fill-current' : ''}`} />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline View */
        <div className="space-y-5 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200">
          {filteredNotes.map((note) => {
            const IconComponent = getIcon(note.type);
            const colorClass = getTypeColor(note.type);
            const categoryBadgeClass = getCategoryBadgeClass(note.category);

            return (
              <div key={note.id} className="relative pl-12 flex items-start gap-4">
                <div className={`absolute left-3.5 top-1.5 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center border ${colorClass} bg-white shadow-2xs`}>
                  <IconComponent className="w-3 h-3" />
                </div>

                <div 
                  onClick={() => onSelectNote(note.id)}
                  className="flex-1 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-violet-300 hover:shadow-sm transition-all duration-150 cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">{note.savedDate} • {note.savedTime}</span>
                    {note.category && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${categoryBadgeClass}`}>
                        {note.category}
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-violet-700 transition-colors">
                    {note.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                    {note.summary || note.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid View (3 Columns, Clean Crisp Borders matching Home page) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotes.map((note) => {
            const IconComponent = getIcon(note.type);
            const colorClass = getTypeColor(note.type);
            const categoryBadgeClass = getCategoryBadgeClass(note.category);

            return (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className="bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between group space-y-3.5 text-slate-800"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border flex items-center gap-1.5 ${colorClass}`}>
                        <IconComponent className="w-3 h-3" />
                        <span>{note.type}</span>
                      </span>
                      {note.category && (
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border ${categoryBadgeClass}`}>
                          {note.category}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(note.id);
                      }}
                      className="text-slate-300 hover:text-amber-400 transition-colors p-1 cursor-pointer"
                      title={note.pinned ? 'Unpin note' : 'Pin note'}
                    >
                      <Pin className={`w-4 h-4 ${note.pinned ? 'text-amber-400 fill-current' : ''}`} />
                    </button>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-2 leading-snug">
                    {note.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed font-normal">
                    {note.summary || note.content}
                  </p>

                  {/* Attachment indicators */}
                  {note.attachments && note.attachments.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-700 bg-violet-50/80 border border-violet-200/80 px-2.5 py-0.5 rounded-lg w-fit">
                      <Paperclip className="w-3 h-3 text-violet-600" />
                      <span>{note.attachments.length} attachment{note.attachments.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{note.tags && note.tags.length > 0 ? note.tags.map(t => `#${t}`).join(' ') : (note.category || 'General')}</span>
                  </div>
                  <span className="shrink-0">{note.savedDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
