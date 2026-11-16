'use client';

import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Calendar, Check, Clock, Filter, AlertCircle, Compass, Search, FileText, Trash2 } from 'lucide-react';
import { Note } from '../mockData';
import { notesService } from '../lib/services/notesService';

interface TasksViewProps {
  notes?: Note[];
  onUpdateNote?: (note: Note) => void;
  selectedCategory?: string;
  userId?: string | null;
}

interface CustomTask {
  id: string;
  text: string;
  completed: boolean;
  priority?: string;
  dueDate?: string;
  category?: string;
  noteId?: undefined;
}

function getEffectiveUserId(propUserId?: string | null): string | null {
  if (propUserId) return propUserId;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('memoflow_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && typeof parsed.id === 'string') {
        return parsed.id;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function loadPersistedCustomTasks(userId: string | null): CustomTask[] {
  if (!userId || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`memoflow_custom_tasks_${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(t => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.text === 'string');
    }
  } catch (e) {
    console.warn('Failed to load custom tasks:', e);
  }
  return [];
}

function savePersistedCustomTasks(userId: string | null, customTasks: CustomTask[]): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`memoflow_custom_tasks_${userId}`, JSON.stringify(customTasks));
  } catch (e) {
    console.warn('Failed to save custom tasks:', e);
  }
}

export default function TasksView({ notes = [], onUpdateNote, selectedCategory = 'All Contexts', userId }: TasksViewProps) {
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [noteTasks, setNoteTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskText, setNewTaskText] = useState('');

  // 1. Load persisted custom tasks on mount / when userId changes
  useEffect(() => {
    const effectiveUid = getEffectiveUserId(userId);
    if (effectiveUid) {
      setCustomTasks(loadPersistedCustomTasks(effectiveUid));
    }
  }, [userId]);

  // 2. Extract note-derived tasks whenever notes prop changes (isolated from custom tasks)
  useEffect(() => {
    const extractedMap = new Map<string, any>();

    (notes || []).forEach(n => {
      (n.tasks || []).forEach(t => {
        const normText = (t.text || '').trim().toLowerCase();
        if (!normText) return;
        const dedupeKey = `${n.id}:::${normText}`;

        if (!extractedMap.has(dedupeKey)) {
          extractedMap.set(dedupeKey, {
            id: t.id,
            noteId: n.id,
            text: t.text,
            completed: t.completed ?? false,
            priority: 'medium',
            dueDate: n.savedDate || 'Today',
            category: n.category || 'Personal',
            noteTitle: n.title
          });
        } else {
          // If any duplicate was completed, preserve completed state
          const existing = extractedMap.get(dedupeKey);
          if (t.completed && !existing.completed) {
            existing.completed = true;
            existing.id = t.id;
          }
        }
      });
    });

    setNoteTasks(Array.from(extractedMap.values()));
  }, [notes]);

  // Filter standalone custom tasks by selected workspace context category
  const visibleCustomTasks = customTasks.filter(t => {
    if (!selectedCategory || selectedCategory === 'All Contexts') return true;
    return (t.category || 'Personal') === selectedCategory;
  });

  // Combined tasks respect active context category (notes are already filtered in page.tsx)
  const combinedTasks = [...visibleCustomTasks, ...noteTasks];

  const toggleTask = (id: string) => {
    const effectiveUid = getEffectiveUserId(userId);

    // Check if it's a standalone custom task
    const isCustom = customTasks.some(t => t.id === id);
    if (isCustom) {
      const updated = customTasks.map(t => 
        t.id === id ? { ...t, completed: !t.completed } : t
      );
      setCustomTasks(updated);
      savePersistedCustomTasks(effectiveUid, updated);
      return;
    }

    // Otherwise handle note-derived task
    const targetTask = noteTasks.find(t => t.id === id);
    if (!targetTask) return;

    const newCompleted = !targetTask.completed;

    // Pure local state update for instant UI response
    setNoteTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted } : t));

    // Notify parent note
    if (targetTask.noteId && onUpdateNote) {
      const parentNote = notes.find(n => n.id === targetTask.noteId);
      if (parentNote) {
        const updatedTasks = (parentNote.tasks || []).map(t => 
          t.id === id ? { ...t, completed: newCompleted } : t
        );
        onUpdateNote({ ...parentNote, tasks: updatedTasks });
      }
    }
  };

  const handleDeleteTask = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const effectiveUid = getEffectiveUserId(userId);

    // Check if it's a standalone custom task
    const isCustom = customTasks.some(t => t.id === id);
    if (isCustom) {
      const updated = customTasks.filter(t => t.id !== id);
      setCustomTasks(updated);
      savePersistedCustomTasks(effectiveUid, updated);
      return;
    }

    // Otherwise handle note-derived task
    const targetTask = noteTasks.find(t => t.id === id);
    if (!targetTask) return;

    // Pure local note tasks state update
    setNoteTasks(prev => prev.filter(t => t.id !== id));

    // Notify parent note (without deleting parent note)
    if (targetTask.noteId && onUpdateNote) {
      const parentNote = notes.find(n => n.id === targetTask.noteId);
      if (parentNote) {
        const updatedTasks = (parentNote.tasks || []).filter(t => t.id !== id);
        onUpdateNote({ ...parentNote, tasks: updatedTasks });
      }
    }

    // Persist deletion in database if task was stored remotely
    try {
      await notesService.deleteTask(id);
    } catch (err) {
      console.warn('Failed to delete task from persistence:', err);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const effectiveUid = getEffectiveUserId(userId);

    const assignedCategory = selectedCategory && selectedCategory !== 'All Contexts'
      ? selectedCategory
      : 'Personal';

    const newTask: CustomTask = {
      id: `custom-t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: newTaskText.trim(),
      completed: false,
      priority: 'medium',
      dueDate: 'Today',
      category: assignedCategory
    };

    const updated = [newTask, ...customTasks];
    setCustomTasks(updated);
    savePersistedCustomTasks(effectiveUid, updated);
    setNewTaskText('');
  };

  const filteredTasks = combinedTasks.filter(t => {
    const matchFilter = filter === 'active' ? !t.completed : filter === 'completed' ? t.completed : true;
    const matchSearch = t.text.toLowerCase().includes(searchQuery.toLowerCase()) || (t.noteTitle && t.noteTitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchFilter && matchSearch;
  });

  const completedCount = combinedTasks.filter(t => t.completed).length;
  const progressPercent = combinedTasks.length > 0 ? Math.round((completedCount / combinedTasks.length) * 100) : 0;

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'University': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'Personal': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Office': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Research': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'Projects': return 'text-amber-700 bg-amber-50 border-amber-200';
      default: return 'text-violet-700 bg-violet-50 border-violet-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      
      {/* Header & Completion Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Action Tasks
            </h1>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200/90 px-2 py-0.5 rounded-full shadow-2xs">
              {combinedTasks.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Interactive checklists automatically extracted from your notes.
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 px-4 shadow-xs flex items-center gap-3.5 self-start sm:self-auto">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center font-extrabold text-xs text-violet-700 shadow-2xs">
            {progressPercent}%
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">{completedCount} of {combinedTasks.length} Completed</span>
            <span className="text-[10px] text-slate-400 font-medium block">Action item progress</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col md:flex-row gap-3 sm:gap-4 items-center justify-between">
        <div className="relative flex items-center w-full md:w-80">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action items..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-violet-500 font-medium transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'All Tasks' },
            { id: 'active', label: 'Active' },
            { id: 'completed', label: 'Completed' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Task Input Form */}
      <form onSubmit={handleAddTask} className="flex gap-2.5">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Add a custom task..."
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 shadow-xs font-medium transition-colors"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> <span>Add Task</span>
        </button>
      </form>

      {/* Tasks List / Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-2xs space-y-3 max-w-md mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100 flex items-center justify-center mx-auto shadow-2xs">
            <Compass className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">No action items found</h3>
            <p className="text-xs text-slate-500 font-medium">
              Tasks are automatically extracted when you save notes or voice clips containing checklist items.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredTasks.map((t) => (
            <div 
              key={t.id} 
              className={`p-4 sm:px-5 flex items-start sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/70 ${
                t.completed ? 'bg-slate-50/40' : 'bg-white'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 sm:mt-0 ${
                    t.completed 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs' 
                      : 'border-slate-300 bg-white hover:border-violet-400'
                  }`}
                  aria-label={t.completed ? 'Mark task incomplete' : 'Mark task complete'}
                >
                  {t.completed && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className={`text-xs font-semibold block leading-snug ${
                    t.completed ? 'line-through text-slate-400' : 'text-slate-900'
                  }`}>
                    {t.text}
                  </span>
                  {t.noteTitle && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium truncate">
                      <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-slate-400 text-[10px] uppercase font-semibold shrink-0">From memory:</span>
                      <span className="truncate text-slate-600 font-medium">{t.noteTitle}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                {t.category && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(t.category)}`}>
                    {t.category}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 font-medium bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded">
                  Due {t.dueDate}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteTask(t.id, e)}
                  className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 ml-0.5"
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
