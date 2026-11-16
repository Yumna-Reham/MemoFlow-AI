'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderPlus, Folder, ArrowRight, Search, ArrowUpDown, Plus, MoreVertical, 
  Trash2, Palette, FileText, Camera, Mic, X, Tag, SlidersHorizontal, Compass, Paperclip, CheckSquare, Layers, BookOpen
} from 'lucide-react';
import { Collection, Note } from '../mockData';
import { collectionsService, EnhancedCollection, DEFAULT_COLLECTIONS, isNoteInCollection } from '@/lib/services/collectionsService';
import { notesService } from '@/lib/services/notesService';

interface CollectionsViewProps {
  collections?: Collection[];
  notes?: Note[];
  onSelectCollection: (colId: string) => void;
  onSelectNote?: (noteId: string) => void;
  onUpdateCollections?: (cols: Collection[]) => void;
  onUpdateNotes?: (notes: Note[]) => void;
}

const GRADIENT_PRESETS = [
  { label: 'Violet-Cyan', value: 'from-violet-600 via-purple-600 to-cyan-500' },
  { label: 'Sky-Blue', value: 'from-sky-500 via-blue-600 to-indigo-700' },
  { label: 'Emerald-Navy', value: 'from-emerald-500 via-teal-600 to-indigo-900' },
  { label: 'Sunset-Amber', value: 'from-amber-500 via-orange-600 to-rose-600' },
  { label: 'Rose-Purple', value: 'from-rose-500 via-fuchsia-600 to-purple-700' }
];

const EMOJI_ICONS = ['🎓', '⚡', '🔮', '📚', '💻', '🎨', '💼', '🧠', '🚀', '📌'];

export default function CollectionsView({ 
  collections = [], 
  notes = [], 
  onSelectCollection, 
  onSelectNote,
  onUpdateCollections,
  onUpdateNotes
}: CollectionsViewProps) {
  const [localCollections, setLocalCollections] = useState<EnhancedCollection[]>(() => {
    const saved = collectionsService.getStoredCollections();
    if (saved && saved.length > 0) {
      const map = new Map<string, EnhancedCollection>();
      DEFAULT_COLLECTIONS.forEach(c => map.set(c.id, c));
      saved.forEach(c => map.set(c.id, c));
      return Array.from(map.values());
    }
    return DEFAULT_COLLECTIONS;
  });

  const [selectedColId, setSelectedColId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'items' | 'updated' | 'name'>('items');

  // Collection Detail View States
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFormat, setDetailFormat] = useState('all');
  const [detailTag, setDetailTag] = useState('all');
  const [detailSort, setDetailSort] = useState<'newest' | 'oldest' | 'title'>('newest');

  // Modal State for New Collection
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColIcon, setNewColIcon] = useState('🎓');
  const [newColGradient, setNewColGradient] = useState(GRADIENT_PRESETS[0].value);

  // Sync collections from persistent storage & props
  useEffect(() => {
    let active = true;
    collectionsService.fetchCollections().then(cols => {
      if (active) {
        setLocalCollections(cols || []);
      }
    });
    return () => { active = false; };
  }, [collections]);

  // Dynamically resolve collections from localCollections + active memory collections
  const resolvedCollectionsMap = new Map<string, EnhancedCollection>();

  localCollections.forEach(c => {
    resolvedCollectionsMap.set(c.id.toLowerCase(), c);
    resolvedCollectionsMap.set(c.name.toLowerCase(), c);
  });

  notes.forEach(n => {
    const colName = (n.collection || n.category || '').trim();
    if (colName && colName !== 'unassigned' && colName !== 'general') {
      const key = colName.toLowerCase();
      if (!resolvedCollectionsMap.has(key)) {
        const derivedCol: EnhancedCollection = {
          id: `col-${key}`,
          name: colName,
          description: `Organized memory cluster for ${colName}.`,
          coverGradient: 'from-violet-600 via-indigo-600 to-cyan-500',
          itemCount: 0,
          progress: 0,
          color: '#8B5CF6',
          icon: '📁',
          updatedAt: 'Recently'
        };
        resolvedCollectionsMap.set(key, derivedCol);
      }
    }
  });

  const allCollectionsList = Array.from(new Set(resolvedCollectionsMap.values()));

  // Filter & Sort Logic for Grid
  const trimmedGridQuery = searchQuery.trim().toLowerCase();
  const filteredCollections = allCollectionsList
    .filter(c => 
      !trimmedGridQuery ||
      c.name.toLowerCase().includes(trimmedGridQuery) || 
      (c.description && c.description.toLowerCase().includes(trimmedGridQuery))
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      
      const countA = notes.filter(n => isNoteInCollection(n, a)).length;
      const countB = notes.filter(n => isNoteInCollection(n, b)).length;
      return countB - countA;
    });

  const activeCollection = allCollectionsList.find(c => c.id === selectedColId);

  // Determine real notes belonging to active collection
  const rawCollectionNotes = activeCollection 
    ? notes.filter(n => isNoteInCollection(n, activeCollection))
    : [];

  const collectionTags = Array.from(new Set(rawCollectionNotes.flatMap(n => n.tags || []))).filter(Boolean);

  // Filter & Sort notes inside selected collection
  const trimmedDetailQuery = detailSearch.trim().toLowerCase();
  const filteredCollectionNotes = rawCollectionNotes
    .filter(note => {
      const matchSearch = !trimmedDetailQuery ||
        (note.title || '').toLowerCase().includes(trimmedDetailQuery) ||
        (note.summary || '').toLowerCase().includes(trimmedDetailQuery) ||
        (note.content || '').toLowerCase().includes(trimmedDetailQuery) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(trimmedDetailQuery)));

      const noteType = note.type as string;
      const matchFormat = detailFormat === 'all' ||
        (detailFormat === 'notes' ? noteType === 'note' :
         detailFormat === 'voice' ? noteType === 'voice' :
         detailFormat === 'documents' ? (noteType === 'pdf' || noteType === 'docx' || noteType === 'ocr') :
         detailFormat === 'images' ? (noteType === 'screenshot' || noteType === 'image') :
         noteType === detailFormat);

      const matchTag = detailTag === 'all' || (note.tags && note.tags.includes(detailTag));

      return matchSearch && matchFormat && matchTag;
    })
    .sort((a, b) => {
      if (detailSort === 'newest') return new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime();
      if (detailSort === 'oldest') return new Date(a.savedDate).getTime() - new Date(b.savedDate).getTime();
      return (a.title || '').localeCompare(b.title || '');
    });

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      const created = await collectionsService.createCollection(
        newColName.trim(),
        newColDesc.trim() || 'Organized topic cluster deck.',
        newColIcon,
        newColGradient
      );

      const updated = [created, ...localCollections.filter(c => c.id !== created.id)];
      setLocalCollections(updated);
      if (onUpdateCollections) {
        onUpdateCollections(updated);
      }
      setIsModalOpen(false);
      setNewColName('');
      setNewColDesc('');
    } catch (err) {
      console.error('Failed to persist collection:', err);
      alert('Failed to save collection. Please try again.');
    }
  };

  const handleDeleteCollection = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete collection "${name}"? (Your saved memories will remain safely intact in All Memories)`)) {
      await collectionsService.deleteCollection(id);
      
      // Disassociate notes assigned to this collection without deleting the memories
      const updatedNotes = notes.map(n => {
        if (isNoteInCollection(n, name) || isNoteInCollection(n, id)) {
          const unassigned = { ...n, collection: '' };
          notesService.updateNote(unassigned);
          return unassigned;
        }
        return n;
      });

      if (onUpdateNotes) {
        onUpdateNotes(updatedNotes);
      }

      const updatedCols = localCollections.filter(c => c.id !== id);
      setLocalCollections(updatedCols);
      if (onUpdateCollections) {
        onUpdateCollections(updatedCols);
      }
      if (selectedColId === id) setSelectedColId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none">
      
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Collections
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Organize your memories by project, topic, or area of life.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {selectedColId ? (
            <button
              onClick={() => {
                setSelectedColId(null);
                setDetailSearch('');
                setDetailFormat('all');
                setDetailTag('all');
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              ← Back to Collections
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ New Collection</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter & Search Strip for Grid */}
      {!selectedColId && (
        <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
          <div className="relative flex items-center w-full md:w-80">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search collections..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-violet-500 font-medium transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort:</span>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs text-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer text-xs"
              >
                <option value="items">Most Items</option>
                <option value="name">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. COLLECTION DETAIL VIEW */}
      {selectedColId && activeCollection ? (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="space-y-5"
        >
          {/* Collection Banner Header */}
          <div className="p-5 sm:p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${activeCollection.coverGradient || 'from-violet-600 to-cyan-500'} flex items-center justify-center text-white text-lg shadow-2xs shrink-0`}>
                  {activeCollection.icon || '📁'}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{activeCollection.name}</h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {activeCollection.description || 'Memories organized in this collection'}
                  </p>
                </div>
              </div>

              {/* Dynamic Real Data Counts Summary Pill */}
              {(() => {
                const memCount = rawCollectionNotes.length;
                const fileCount = rawCollectionNotes.reduce((acc, n) => acc + (n.attachments ? n.attachments.length : 0), 0);
                const taskCount = rawCollectionNotes.reduce((acc, n) => acc + (n.tasks ? n.tasks.length : 0), 0);
                return (
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
                    <span className="text-violet-700 font-bold">{memCount} {memCount === 1 ? 'memory' : 'memories'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-blue-700 font-bold">{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700 font-bold">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Collection Detail Toolbar */}
          <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
            {/* Search within collection */}
            <div className="relative flex items-center w-full md:w-72">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="Search within collection..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-violet-500 font-medium transition-colors"
              />
            </div>

            {/* Format Pills Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'notes', label: 'Notes' },
                { id: 'voice', label: 'Voice' },
                { id: 'documents', label: 'Documents' },
                { id: 'images', label: 'Images' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDetailFormat(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    detailFormat === f.id
                      ? 'bg-violet-600 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtered Collection Memories */}
          {filteredCollectionNotes.length === 0 ? (
            <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl text-slate-500 text-xs font-medium space-y-2 shadow-2xs">
              <p className="font-extrabold text-slate-800 text-sm">No memories organized in this collection yet.</p>
              <p className="text-slate-400">Save notes or assign them under "{activeCollection.name}" to organize them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCollectionNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => onSelectNote && onSelectNote(note.id)}
                  className="bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-lg border bg-violet-50 text-violet-700 border-violet-200">
                        {note.type}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">{note.savedDate}</span>
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 group-hover:text-violet-700 transition-colors line-clamp-2">
                      {note.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-normal">
                      {note.summary || note.content}
                    </p>

                    {note.attachments && note.attachments.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-xl w-fit">
                        <Paperclip className="w-3.5 h-3.5 text-violet-600" />
                        <span>{note.attachments.length} attachment{note.attachments.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                      <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{note.tags && note.tags.length > 0 ? note.tags.map(t => `#${t}`).join(' ') : (note.category || 'General')}</span>
                    </div>
                    <span className="text-violet-600 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5 shrink-0">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ) : filteredCollections.length === 0 ? (
        /* Empty State Card for Collections Grid */
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-2xs space-y-4 max-w-md mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">No collections found</h3>
            <p className="text-xs text-slate-500 font-medium">
              Organize your memories by project, topic, or area of life.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-xs shadow-indigo-500/20 cursor-pointer"
          >
            + Create Your First Collection
          </button>
        </div>
      ) : (
        /* 4. Collection Organizational Container Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCollections.map((col) => {
            const matching = notes.filter(n => isNoteInCollection(n, col));

            // Dynamic Real Data Counts (NO fabricated/hardcoded numbers)
            const memCount = matching.length;
            const fileCount = matching.reduce((acc, n) => acc + (n.attachments ? n.attachments.length : 0), 0);
            const taskCount = matching.reduce((acc, n) => acc + (n.tasks ? n.tasks.length : 0), 0);

            return (
              <motion.div
                key={col.id}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                onClick={() => {
                  setSelectedColId(col.id);
                  onSelectCollection(col.id);
                }}
                className="group bg-white border border-slate-200/90 hover:border-violet-300 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-r ${col.coverGradient || 'from-violet-600 to-indigo-600'} flex items-center justify-center text-white text-sm shadow-2xs shrink-0`}>
                        {col.icon || '📁'}
                      </div>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-violet-600 transition-colors">
                        {col.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteCollection(col.id, col.name, e)}
                      className="p-1.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete Collection Container"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                    {col.description}
                  </p>
                </div>

                {/* Organizational Summary Strip (Real Dynamic Counts Only) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200/70 px-3 py-1.5 rounded-xl">
                    <span className="text-violet-700 font-bold">{memCount} {memCount === 1 ? 'memory' : 'memories'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-blue-700 font-bold">{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700 font-bold">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-[11px] font-medium">
                    <span className="text-violet-600 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 5. "+ New Collection" Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-5 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-violet-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">Create New Collection</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCollection} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="e.g., Office, University, MemoFlow, Research"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Description & Topic Context
                  </label>
                  <textarea
                    rows={2}
                    value={newColDesc}
                    onChange={(e) => setNewColDesc(e.target.value)}
                    placeholder="Brief description of memories organized inside..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Collection Icon Badge
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewColIcon(emoji)}
                        className={`w-9 h-9 rounded-xl border text-base flex items-center justify-center cursor-pointer transition-all ${
                          newColIcon === emoji ? 'border-purple-600 bg-purple-50 shadow-xs scale-105' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gradient Theme Picker */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Accent Color Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setNewColGradient(preset.value)}
                        className={`p-2 rounded-xl border text-left text-[11px] font-bold flex items-center gap-2 cursor-pointer transition-all ${
                          newColGradient === preset.value ? 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/50' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-gradient-to-r ${preset.value} shrink-0`} />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-xs shadow-md shadow-purple-500/20 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Create Collection
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
