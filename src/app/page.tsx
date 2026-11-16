'use client';

import React, { useState, useEffect, useRef } from 'react';
import LandingPage from '@/components/LandingPage';
import AuthScreen from '@/components/AuthScreen';
import Sidebar from '@/components/Sidebar';
import DashboardHome from '@/components/DashboardHome';
import LibraryView from '@/components/LibraryView';
import CollectionsView from '@/components/CollectionsView';
import FilesView from '@/components/FilesView';
import TasksView from '@/components/TasksView';
import VoiceAssistant from '@/components/VoiceAssistant';
import SettingsView from '@/components/SettingsView';
import QuickCaptureModal from '@/components/QuickCaptureModal';
import SpotlightSearchModal from '@/components/SpotlightSearchModal';
import NoteDetailView from '@/components/NoteDetailView';
import NotificationToast, { ToastMessage } from '@/components/NotificationToast';
import { initialNotes, Note, initialCollections, Collection, WORKSPACE_CATEGORIES, WorkspaceCategory } from '@/mockData';
import { authService, getInitials } from '@/lib/services/authService';
import { notesService } from '@/lib/services/notesService';
import { collectionsService } from '@/lib/services/collectionsService';
import { Search, Plus, Sparkles, Filter, Layers } from 'lucide-react';

export default function Home() {
  const [screen, setScreen] = useState<'landing' | 'auth' | 'app'>('landing');
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState<WorkspaceCategory>('All Contexts');

  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureType, setQuickCaptureType] = useState('note');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, description?: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const resolveDashboardSession = async () => {
    setAuthLoading(true);
    try {
      // Securely fetch active session using supabase.auth.getUser()
      const user = await authService.getUser();
      if (user) {
        let displayName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (!displayName || !displayName.trim()) {
          const email = (user.email || '').toLowerCase().trim();
          if (email.includes('@')) {
            const prefix = email.split('@')[0].trim();
            if (prefix) {
              displayName = prefix
                .split(/[._-]+/)
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            }
          }
        }

        const finalName = displayName?.trim() || 'User';
        setCurrentUser({ id: user.id, name: finalName, email: user.email || '' });
        // Update loading state immediately so skeleton loader disappears and displays user name/email
        setAuthLoading(false);

        const fetchedNotes = await notesService.fetchNotes(user.id);
        setNotes(fetchedNotes || []);

        const fetchedCols = await collectionsService.fetchCollections(user.id);
        setCollections(fetchedCols || []);
      } else {
        // If no active user session exists when accessing workspace, gracefully redirect to auth login
        setCurrentUser(null);
        setNotes([]);
        setCollections([]);
        setSelectedNoteId(null);
        setAuthLoading(false);
        setAuthMode('login');
        setScreen('auth');
        addToast('info', 'Session Required', 'Please sign in to access your AI memory workspace.');
      }
    } catch (err) {
      console.warn('Dashboard session resolution warning:', err);
      setCurrentUser(null);
      setNotes([]);
      setCollections([]);
      setSelectedNoteId(null);
      setAuthLoading(false);
      setAuthMode('login');
      setScreen('auth');
    }
  };

  const handleLandingStart = async (mode: 'login' | 'signup') => {
    if (mode === 'login') {
      // Always open the authentication screen in 'login' mode
      setAuthMode('login');
      setScreen('auth');
    } else {
      // For 'signup' / 'Get Started', launch active dashboard if session exists
      const user = await authService.getUser();
      if (user) {
        setScreen('app');
        resolveDashboardSession();
      } else {
        setAuthMode('signup');
        setScreen('auth');
      }
    }
  };

  useEffect(() => {
    // Initial background user check & session restoration on mount
    authService.getUser().then((user) => {
      if (user) {
        let displayName = user.user_metadata?.full_name || user.user_metadata?.name;
        if (!displayName || !displayName.trim()) {
          const email = (user.email || '').toLowerCase().trim();
          if (email.includes('@')) {
            const prefix = email.split('@')[0].trim();
            if (prefix) {
              displayName = prefix
                .split(/[._-]+/)
                .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            }
          }
        }
        setCurrentUser({ id: user.id, name: displayName?.trim() || 'User', email: user.email || '' });
        setScreen('app');
        resolveDashboardSession();
      } else {
        setCurrentUser(null);
        setNotes([]);
        setCollections([]);
        setSelectedNoteId(null);
        setAuthLoading(false);
      }
    });

    const { data: authListener } = authService.onAuthStateChange((event, session) => {
      if (session) {
        authService.getUser().then((u) => {
          if (u) {
            let name = u.user_metadata?.full_name || u.user_metadata?.name;
            if (!name || !name.trim()) {
              const email = (u.email || '').toLowerCase().trim();
              if (email.includes('@')) {
                const prefix = email.split('@')[0].trim();
                name = prefix.split(/[._-]+/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
              }
            }
            setCurrentUser({ id: u.id, name: name?.trim() || 'User', email: u.email || '' });
            if (screenRef.current !== 'app') {
              setScreen('app');
              resolveDashboardSession();
            }
          }
        });
      } else {
        setCurrentUser(null);
        setNotes([]);
        setCollections([]);
        setSelectedNoteId(null);
        if (screenRef.current === 'app') {
          setScreen('landing');
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setNotes([]);
    setCollections([]);
    setSelectedNoteId(null);
    setAuthMode('login');
    setScreen('auth');
    addToast('info', 'Logged Out', 'You have been signed out of your AI workspace.');
  };

  const handleOpenQuickCapture = (type: string = 'note') => {
    setQuickCaptureType(type);
    setQuickCaptureOpen(true);
  };

  const handleSaveNote = async (newNote: Note) => {
    setNotes((prev) => [newNote, ...prev.filter(n => n.id !== newNote.id)]);
    addToast('success', 'Memory Saved & Ingested', `"${newNote.title}" saved to ${newNote.category || 'Personal'} context.`);
    const persisted = await notesService.createNote(newNote, currentUser?.id);
    if (persisted && persisted.id !== newNote.id) {
      setNotes((prev) => prev.map((n) => (n.id === newNote.id ? persisted : n)));
    }
  };

  const handleUpdateNote = async (updatedNote: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
    const persisted = await notesService.updateNote(updatedNote, currentUser?.id);
    if (persisted && persisted.id !== updatedNote.id) {
      setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? persisted : n)));
    }
  };

  const handleToggleFavorite = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned: !n.pinned } : n));
    await notesService.togglePin(noteId, note.pinned, currentUser?.id);
  };

  const handleDeleteNote = async (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    addToast('info', 'Memory Note Deleted', 'The note has been removed from your workspace.');
    try {
      const result = await notesService.deleteNote(noteId, currentUser?.id);
      if (!result.success) {
        console.warn('[handleDeleteNote] Supabase deletion status:', result);
      }
    } catch (err) {
      console.warn('handleDeleteNote warning:', err);
    }
  };

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
  };

  // Filter notes by selected workspace context category
  const filteredNotes = selectedCategory === 'All Contexts'
    ? notes
    : notes.filter(n => (n.category || 'Personal') === selectedCategory);

  if (screen === 'landing') {
    return (
      <LandingPage 
        onStart={handleLandingStart}
      />
    );
  }

  if (screen === 'auth') {
    return (
      <AuthScreen 
        initialMode={authMode}
        onBack={() => setScreen('landing')}
        onSuccess={() => {
          setScreen('app');
          resolveDashboardSession();
          addToast('success', 'Authentication Successful', 'Welcome to your AI memory workspace.');
        }}
      />
    );
  }

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden select-none relative">
      
      {/* Extremely Subtle Ambient Purple & Cyan Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none z-0" />
      
      {/* Toast Notifications */}
      <NotificationToast toasts={toasts} onDismiss={removeToast} />

      {/* Pane 1: Left Persistent Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        setTab={(tab) => {
          setCurrentTab(tab);
          setSelectedNoteId(null);
        }}
        onLogout={handleLogout}
        onQuickCapture={() => handleOpenQuickCapture('note')}
        user={currentUser}
        notes={notes}
        noteCount={notes.length}
        loading={authLoading}
      />

      {/* Main Workspace Area (Navbar + Viewport) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden z-10">
        
        {/* Pane 2: Persistent Top Sticky Glass Navbar */}
        <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between z-20 shrink-0 gap-4 text-slate-900 shadow-2xs">
          
          {/* Left Search Bar Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 px-4 py-2 bg-slate-100/80 hover:bg-slate-100 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-700 text-xs font-medium w-56 sm:w-64 transition-all duration-150 cursor-pointer shadow-xs group"
            >
              <Search className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              <span className="flex-1 text-left truncate text-slate-500">Search memory (Ctrl+K)...</span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-extrabold bg-white rounded-lg border border-slate-200 text-slate-500 shadow-2xs">
                Ctrl+K
              </kbd>
            </button>

            {/* Workspace Category Context Filter Pill Bar */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200 shadow-xs">
              <Layers className="w-3.5 h-3.5 text-purple-600 ml-2" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as WorkspaceCategory)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-2"
              >
                {WORKSPACE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-white text-slate-800">{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">
            
            {/* Quick Capture '+' Button */}
            <button
              onClick={() => handleOpenQuickCapture('note')}
              className="w-9 h-9 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:opacity-95 text-white flex items-center justify-center shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              title="Quick Capture"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Profile Avatar */}
            <div 
              onClick={() => setCurrentTab('settings')}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 border border-purple-300 text-white font-bold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all shadow-2xs"
            >
              {authLoading ? (
                <span className="w-3 h-3 bg-white/40 rounded-full animate-pulse" />
              ) : (
                <span>{getInitials(currentUser?.name)}</span>
              )}
            </div>
          </div>
        </header>

        {/* Viewport Router Container */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Pane 3: Main Dynamic Content View */}
          <main className="flex-1 overflow-y-auto pt-3 px-6 pb-6 md:pt-3.5 md:px-8 md:pb-8">
            {selectedNote ? (
              <NoteDetailView 
                note={selectedNote}
                onClose={() => setSelectedNoteId(null)}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
              />
            ) : (
              <>
                {currentTab === 'home' && (
                  <DashboardHome 
                    notes={filteredNotes}
                    allNotes={notes}
                    collections={collections}
                    onSelectNote={handleSelectNote}
                    onOpenQuickCapture={handleOpenQuickCapture}
                    onTriggerSearch={() => setSearchOpen(true)}
                    onUpdateNote={handleUpdateNote}
                    user={currentUser}
                    loading={authLoading}
                  />
                )}

                {(currentTab === 'library' || currentTab === 'inbox' || currentTab === 'notes') && (
                  <LibraryView 
                    notes={filteredNotes}
                    collections={collections}
                    onSelectNote={handleSelectNote}
                    onToggleFavorite={handleToggleFavorite}
                    onOpenQuickCapture={() => handleOpenQuickCapture('note')}
                    title="All Memories"
                    subtitle="Browse, filter, and search through all your saved knowledge."
                  />
                )}

                {currentTab === 'collections' && (
                  <CollectionsView 
                    collections={collections}
                    notes={notes}
                    onSelectCollection={() => {}}
                    onSelectNote={handleSelectNote}
                    onUpdateCollections={(updated) => setCollections(updated)}
                    onUpdateNotes={(updated) => setNotes(updated)}
                  />
                )}

                {currentTab === 'files' && (
                  <FilesView 
                    notes={filteredNotes}
                    onSelectNote={handleSelectNote}
                    onOpenQuickCapture={() => handleOpenQuickCapture('pdf')}
                  />
                )}

                {currentTab === 'tasks' && (
                  <TasksView 
                    notes={filteredNotes}
                    onUpdateNote={handleUpdateNote}
                    selectedCategory={selectedCategory}
                    userId={currentUser?.id}
                  />
                )}

                {currentTab === 'memo-ai' && (
                  <VoiceAssistant 
                    notes={filteredNotes}
                    activeNote={selectedNote}
                  />
                )}

                {currentTab === 'settings' && (
                  <SettingsView 
                    user={currentUser}
                    notes={notes}
                    collections={collections}
                    noteCount={notes.length}
                    onLogout={handleLogout}
                    onUpdateUser={(updated) => {
                      setCurrentUser(prev => prev ? { ...prev, name: updated.name } : null);
                    }}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <SpotlightSearchModal 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)}
        notes={filteredNotes}
        onSelectNote={(id) => {
          handleSelectNote(id);
          setSearchOpen(false);
        }}
      />

      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        collections={collections}
        preselectedType={quickCaptureType}
        onSaveNote={handleSaveNote}
      />
    </div>
  );
}
