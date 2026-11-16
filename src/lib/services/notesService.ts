import { createClient } from '../supabase/client';
import { Note, Task, NoteAttachment } from '@/mockData';
import { storageService } from './storageService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getActiveUserId(): string | null {
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

function getNotesStorageKey(userId?: string | null): string | null {
  const uid = userId || getActiveUserId();
  return uid ? `memoflow_persisted_notes_${uid}` : null;
}

function getDeletedStorageKey(userId?: string | null): string | null {
  const uid = userId || getActiveUserId();
  return uid ? `memoflow_deleted_note_ids_${uid}` : null;
}

const DEMO_NOTE_IDS = new Set([
  'note-pers-1',
  'note-pers-2',
  'note-pers-3',
  'note-pers-4',
  'note-off-1'
]);

function getLocalNotes(userId?: string | null): Note[] {
  if (typeof window === 'undefined') return [];
  const key = getNotesStorageKey(userId);
  if (!key) return [];

  try {
    const rawScoped = localStorage.getItem(key);
    if (rawScoped) {
      try {
        const parsed = JSON.parse(rawScoped);
        if (Array.isArray(parsed)) {
          return parsed.filter((n: Note) => n && n.id && !DEMO_NOTE_IDS.has(n.id));
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    // Migration for the active authenticated user from legacy global keys
    const rawV2 = localStorage.getItem('memoflow_persisted_notes_v2');
    const rawNotes = localStorage.getItem('memoflow_custom_notes');
    const rawLegacy = localStorage.getItem('memoflow_notes');

    if (rawV2 || rawNotes || rawLegacy) {
      const mergedMap = new Map<string, Note>();

      [rawV2, rawNotes, rawLegacy].forEach(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((n: Note) => {
                if (n && n.id && !DEMO_NOTE_IDS.has(n.id)) {
                  mergedMap.set(n.id, n);
                }
              });
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      });

      const cleanNotes = Array.from(mergedMap.values());
      localStorage.setItem(key, JSON.stringify(cleanNotes));
      localStorage.removeItem('memoflow_persisted_notes_v2');
      localStorage.removeItem('memoflow_custom_notes');
      localStorage.removeItem('memoflow_notes');
      return cleanNotes;
    }

    return [];
  } catch (e) {
    return [];
  }
}

function saveLocalNotes(notes: Note[], userId?: string | null): void {
  if (typeof window === 'undefined') return;
  const key = getNotesStorageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(notes));
  } catch (e) {
    console.warn('Failed to save notes to localStorage:', e);
  }
}

function getTombstoneIds(userId?: string | null): string[] {
  if (typeof window === 'undefined') return [];
  const key = getDeletedStorageKey(userId);
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function addTombstoneId(noteId: string, userId?: string | null): void {
  if (typeof window === 'undefined' || !noteId) return;
  const key = getDeletedStorageKey(userId);
  if (!key) return;
  try {
    const current = getTombstoneIds(userId);
    if (!current.includes(noteId)) {
      localStorage.setItem(key, JSON.stringify([...current, noteId]));
    }
  } catch (e) {
    console.warn('Failed to add tombstone ID:', e);
  }
}

function removeTombstoneId(noteId: string, userId?: string | null): void {
  if (typeof window === 'undefined' || !noteId) return;
  const key = getDeletedStorageKey(userId);
  if (!key) return;
  try {
    const current = getTombstoneIds(userId);
    const updated = current.filter(id => id !== noteId);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to remove tombstone ID:', e);
  }
}

function deduplicateAttachments(attachments: NoteAttachment[]): NoteAttachment[] {
  if (!attachments || attachments.length === 0) return [];
  const seen = new Set<string>();
  const res: NoteAttachment[] = [];
  for (const a of attachments) {
    const key = a.path || storageService.extractPath(a.url) || a.url || a.name;
    if (key && !seen.has(key)) {
      seen.add(key);
      res.push(a);
    }
  }
  return res;
}

async function persistAttachmentsIdempotent(
  supabase: any,
  noteId: string,
  userId: string,
  attachments: NoteAttachment[]
): Promise<void> {
  if (!supabase || !noteId || !userId || !attachments || attachments.length === 0) {
    return;
  }

  try {
    // 1. Fetch existing attachment records for this note
    const { data: existingRows, error: fetchErr } = await supabase
      .from('attachments')
      .select('id, url, name')
      .eq('note_id', noteId);

    if (fetchErr) {
      console.warn('[persistAttachmentsIdempotent] Error fetching existing attachments:', fetchErr);
    }

    const existingByPath = new Map<string, string>(); // canonicalPath -> db row id
    const existingById = new Set<string>();

    if (existingRows) {
      for (const row of existingRows) {
        if (row.id) existingById.add(row.id);
        const canon = storageService.extractPath(row.url) || row.url;
        if (canon && !existingByPath.has(canon)) {
          existingByPath.set(canon, row.id);
        }
      }
    }

    // 2. Build deduplicated rows
    const seenIncoming = new Set<string>();
    const rowsToUpsert: any[] = [];

    for (const att of attachments) {
      const canonicalPath = att.path || storageService.extractPath(att.url) || att.url;
      const dedupeKey = canonicalPath || att.name;
      if (!dedupeKey || seenIncoming.has(dedupeKey)) {
        continue;
      }
      seenIncoming.add(dedupeKey);

      // Match against existing record to reuse its ID
      let matchedId: string | undefined = undefined;
      if (att.id && existingById.has(att.id)) {
        matchedId = att.id;
      } else if (canonicalPath && existingByPath.has(canonicalPath)) {
        matchedId = existingByPath.get(canonicalPath);
      } else if (att.id && UUID_REGEX.test(att.id)) {
        matchedId = att.id;
      } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        matchedId = crypto.randomUUID();
      }

      rowsToUpsert.push({
        ...(matchedId ? { id: matchedId } : {}),
        note_id: noteId,
        user_id: userId,
        name: att.name,
        type: att.type,
        url: canonicalPath || att.url,
        size_bytes: att.sizeBytes || 0,
      });
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('attachments').upsert(rowsToUpsert);
      if (upsertErr) {
        console.warn('[persistAttachmentsIdempotent] Upsert warning:', upsertErr);
      }
    }
  } catch (err) {
    console.warn('[persistAttachmentsIdempotent] Unexpected error:', err);
  }
}

export const notesService = {
  async fetchNotes(explicitUserId?: string): Promise<Note[]> {
    let activeUserId = explicitUserId || null;
    let supabase: any = null;
    let userData: any = null;

    try {
      supabase = createClient() as any;
      const res = await supabase.auth.getUser();
      userData = res.data;
      if (userData?.user?.id) {
        activeUserId = userData.user.id;
      }
    } catch (e) {
      // Supabase unavailable
    }

    if (!activeUserId) {
      activeUserId = getActiveUserId();
    }

    if (!activeUserId) {
      return [];
    }

    const tombstones = getTombstoneIds(activeUserId);
    let localNotes = getLocalNotes(activeUserId).filter(n => !tombstones.includes(n.id));

    try {
      if (!userData?.user || !supabase) return localNotes;

      // Background retry for pending tombstoned remote deletions
      if (tombstones.length > 0) {
        (async () => {
          for (const tombId of tombstones) {
            try {
              await supabase.from('tasks').delete().eq('note_id', tombId);
              await supabase.from('attachments').delete().eq('note_id', tombId);
              const { error, count } = await supabase.from('notes').delete({ count: 'exact' }).eq('id', tombId);
              if (!error && typeof count === 'number' && count > 0) {
                removeTombstoneId(tombId, activeUserId);
              }
            } catch (retryErr) {
              console.warn('Background tombstone deletion warning:', tombId, retryErr);
            }
          }
        })();
      }

      const { data: rawNotes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (notesError || !rawNotes) {
        return localNotes;
      }

      if (rawNotes.length === 0) {
        // If Supabase table is empty or rejected previous writes, preserve existing local notes for this user
        return localNotes;
      }

      const notesList = (rawNotes as any[]).filter(n => !tombstones.includes(n.id));
      const noteIds = notesList.map(n => n.id);
      
      const { data: rawTasks } = await supabase
        .from('tasks')
        .select('*')
        .in('note_id', noteIds);

      const { data: rawAttachments } = await supabase
        .from('attachments')
        .select('*')
        .in('note_id', noteIds);

      const tasksList = (rawTasks || []) as any[];
      const attachmentsList = (rawAttachments || []) as any[];

      const remoteNotes: Note[] = await Promise.all(notesList.map(async (n) => {
        const rawNoteTasks = tasksList.filter(t => t.note_id === n.id);
        const logicalTaskMap = new Map<string, Task>();
        for (const t of rawNoteTasks) {
          const normText = (t.text || '').trim().toLowerCase();
          if (!normText) continue;

          if (!logicalTaskMap.has(normText)) {
            logicalTaskMap.set(normText, {
              id: t.id,
              text: t.text,
              completed: t.completed ?? false,
            });
          } else {
            // Keep one task, preserve completed = true if any duplicate is completed
            const existing = logicalTaskMap.get(normText)!;
            if (t.completed && !existing.completed) {
              existing.completed = true;
              existing.id = t.id;
            }
          }
        }
        const relatedTasks: Task[] = Array.from(logicalTaskMap.values());

        const rawNoteAttachments = attachmentsList.filter(a => a.note_id === n.id);
        const seenStorageKeys = new Set<string>();
        const uniqueAttachments: any[] = [];
        for (const a of rawNoteAttachments) {
          const canonicalPath = storageService.extractPath(a.url) || storageService.extractPath(a.path) || (a.url && a.url.includes('/') && !a.url.startsWith('http') && !a.url.startsWith('data:') ? a.url : undefined);
          const dedupeKey = canonicalPath ? canonicalPath.trim() : (a.id || `raw:${a.name}`);
          if (!seenStorageKeys.has(dedupeKey)) {
            seenStorageKeys.add(dedupeKey);
            uniqueAttachments.push(a);
          }
        }

        const relatedAttachments: NoteAttachment[] = await Promise.all(
          uniqueAttachments.map(async (a) => {
            const canonicalPath = storageService.extractPath(a.url) || storageService.extractPath(a.path) || (a.url && a.url.includes('/') && !a.url.startsWith('http') && !a.url.startsWith('data:') ? a.url : undefined);
            let activeUrl = a.url;
            if (canonicalPath) {
              activeUrl = await storageService.getSignedUrl(canonicalPath);
            }
            return {
              id: a.id,
              name: a.name,
              type: a.type,
              url: activeUrl || a.url,
              path: canonicalPath,
              sizeBytes: a.size_bytes,
            };
          })
        );

        const derivedCategory = n.category || n.context_category || n.metadata?.category || 'Personal';
        const isColUuid = !!(n.collection_id && UUID_REGEX.test(n.collection_id));

        return {
          id: n.id,
          title: n.title,
          type: (n.type || 'note') as any,
          content: n.content,
          summary: n.summary || '',
          takeaways: n.takeaways || [],
          tasks: relatedTasks,
          flashcards: n.flashcards || [],
          quiz: n.quiz || [],
          collection: isColUuid ? n.collection_id : 'unassigned',
          category: derivedCategory,
          tags: n.tags || [],
          savedDate: n.saved_date || new Date(n.created_at || Date.now()).toISOString().split('T')[0],
          savedTime: n.saved_time || new Date(n.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          pinned: n.pinned ?? false,
          coverImage: n.cover_image || undefined,
          originalUrl: n.original_url || undefined,
          audioDuration: n.audio_duration || undefined,
          attachments: relatedAttachments,
        };
      }));

      const activeRemoteNotes = remoteNotes.filter(n => !tombstones.includes(n.id));

      // Merge remote and local notes (preserving local rich fields if remote schema columns are minimal)
      const mergedMap = new Map<string, Note>();
      localNotes.forEach(n => {
        if (!tombstones.includes(n.id)) mergedMap.set(n.id, n);
      });
      activeRemoteNotes.forEach(remote => {
        if (!tombstones.includes(remote.id)) {
          const local = mergedMap.get(remote.id);
          if (local) {
            mergedMap.set(remote.id, {
              ...local,
              title: remote.title || local.title,
              content: remote.content || local.content,
              summary: remote.summary || local.summary,
              tags: (remote.tags && remote.tags.length > 0) ? remote.tags : local.tags,
              category: remote.category !== 'Personal' ? remote.category : local.category,
              attachments: (remote.attachments && remote.attachments.length > 0)
                ? remote.attachments
                : deduplicateAttachments(local.attachments || []),
              pinned: remote.pinned !== undefined ? remote.pinned : local.pinned,
            });
          } else {
            mergedMap.set(remote.id, remote);
          }
        }
      });

      const mergedList = Array.from(mergedMap.values());
      saveLocalNotes(mergedList, activeUserId);
      return mergedList;
    } catch (err) {
      console.warn('notesService.fetchNotes warning:', err);
      return localNotes;
    }
  },

  async createNote(note: Note, explicitUserId?: string): Promise<Note> {
    const canonicalId = (note.id && UUID_REGEX.test(note.id))
      ? note.id
      : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`);

    const canonicalNote: Note = { ...note, id: canonicalId };

    // Strict separation: UUID -> collection_id, text string -> category/context_category
    const isCollectionUuid = !!(canonicalNote.collection && UUID_REGEX.test(canonicalNote.collection));
    const isTextCategory = !!(
      canonicalNote.collection &&
      !isCollectionUuid &&
      canonicalNote.collection !== 'unassigned' &&
      canonicalNote.collection !== 'general'
    );

    const resolvedCategory = isTextCategory
      ? canonicalNote.collection
      : (canonicalNote.category || 'Personal');

    const collectionId = isCollectionUuid ? canonicalNote.collection : null;

    let userId = explicitUserId || null;
    let supabase: any = null;
    try {
      supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    } catch (e) {
      // Supabase client error
    }

    if (!userId) {
      userId = getActiveUserId();
    }

    // 1. Update localStorage immediately with canonical note scoped to user
    if (userId) {
      const existing = getLocalNotes(userId);
      const updatedLocal = existing.some(n => n.id === canonicalNote.id)
        ? existing.map(n => n.id === canonicalNote.id ? canonicalNote : n)
        : [canonicalNote, ...existing.filter(n => n.id !== canonicalNote.id)];
      saveLocalNotes(updatedLocal, userId);
    }

    // 2. Sync to Supabase DB if available
    try {
      if (!supabase) supabase = createClient() as any;
      if (!userId) {
        const { data: userData } = await supabase.auth.getUser();
        userId = userData?.user?.id || null;
      }

      let payload: any = {
        id: canonicalNote.id,
        user_id: userId,
        title: canonicalNote.title,
        type: canonicalNote.type,
        content: canonicalNote.content,
        summary: canonicalNote.summary,
        takeaways: canonicalNote.takeaways,
        collection_id: collectionId,
        category: resolvedCategory,
        context_category: resolvedCategory,
        metadata: { ...(canonicalNote.metadata || {}), category: resolvedCategory, quiz: canonicalNote.quiz || [] },
        tags: canonicalNote.tags,
        saved_date: canonicalNote.savedDate,
        saved_time: canonicalNote.savedTime,
        pinned: canonicalNote.pinned,
        cover_image: canonicalNote.coverImage,
        original_url: canonicalNote.originalUrl,
        audio_duration: canonicalNote.audioDuration,
      };

      let createdNote: any = null;
      let { data: firstTryNote, error } = await supabase
        .from('notes')
        .upsert(payload)
        .select('*')
        .single();

      if (error) {
        delete payload.context_category;
        let retry1 = await supabase.from('notes').upsert(payload).select('*').single();
        if (retry1.error) {
          delete payload.category;
          let retry2 = await supabase.from('notes').upsert(payload).select('*').single();
          if (retry2.error) {
            const minimalPayload: any = {
              id: canonicalNote.id,
              user_id: userId,
              title: canonicalNote.title,
              type: canonicalNote.type,
              content: canonicalNote.content,
              summary: canonicalNote.summary,
              collection_id: collectionId,
              tags: canonicalNote.tags,
              pinned: canonicalNote.pinned,
              metadata: { ...(canonicalNote.metadata || {}), category: resolvedCategory, quiz: canonicalNote.quiz || [] }
            };
            let retry3 = await supabase.from('notes').upsert(minimalPayload).select('*').single();
            createdNote = retry3.data;
          } else {
            createdNote = retry2.data;
          }
        } else {
          createdNote = retry1.data;
        }
      } else {
        createdNote = firstTryNote;
      }

      // Base schema fallback if optional columns do not exist in live Supabase table
      if (!createdNote && userId) {
        const basePayload = {
          id: canonicalNote.id,
          user_id: userId,
          title: canonicalNote.title || 'Untitled Memory',
          content: canonicalNote.content || '',
        };
        const baseRes = await supabase.from('notes').upsert(basePayload).select('*').single();
        if (baseRes.data) {
          createdNote = baseRes.data;
        }
      }

      const activeNoteId = createdNote?.id || canonicalNote.id;

      if (canonicalNote.tasks && canonicalNote.tasks.length > 0 && userId) {
        try {
          // Query existing remote tasks for activeNoteId to find existing UUIDs by normalized text
          const { data: existingRemoteTasks } = await supabase
            .from('tasks')
            .select('id, text')
            .eq('note_id', activeNoteId);

          const remoteTaskMap = new Map<string, string>();
          if (existingRemoteTasks && Array.isArray(existingRemoteTasks)) {
            for (const rt of existingRemoteTasks) {
              const norm = (rt.text || '').trim().toLowerCase();
              if (norm && rt.id && !remoteTaskMap.has(norm)) {
                remoteTaskMap.set(norm, rt.id);
              }
            }
          }

          const seenNorms = new Set<string>();
          const taskRows: any[] = [];
          for (const t of canonicalNote.tasks) {
            const norm = (t.text || '').trim().toLowerCase();
            if (!norm || seenNorms.has(norm)) continue;
            seenNorms.add(norm);

            const existingUuid = (t.id && UUID_REGEX.test(t.id)) ? t.id : remoteTaskMap.get(norm);
            taskRows.push({
              ...(existingUuid ? { id: existingUuid } : {}),
              note_id: activeNoteId,
              user_id: userId,
              text: t.text.trim(),
              completed: t.completed ?? false,
            });
          }

          if (taskRows.length > 0) {
            await supabase.from('tasks').upsert(taskRows);
          }
        } catch (taskErr) {
          console.warn('Tasks upsert warning:', taskErr);
        }
      }

      if (canonicalNote.attachments && canonicalNote.attachments.length > 0 && userId) {
        await persistAttachmentsIdempotent(supabase, activeNoteId, userId, canonicalNote.attachments);
      }

      const finalNote = { ...canonicalNote, id: activeNoteId, category: resolvedCategory };
      if (userId) {
        saveLocalNotes(getLocalNotes(userId).map(n => n.id === canonicalNote.id ? finalNote : n), userId);
      }
      return finalNote;
    } catch (err) {
      console.warn('notesService.createNote warning:', err);
      return canonicalNote;
    }
  },

  async updateNote(updatedNote: Note, explicitUserId?: string): Promise<Note> {
    let userId = explicitUserId || null;
    let supabase: any = null;
    try {
      supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) userId = userData.user.id;
    } catch (e) {
      // ignore
    }
    if (!userId) userId = getActiveUserId();

    if (userId) {
      const existing = getLocalNotes(userId);
      const updatedLocal = existing.map(n => n.id === updatedNote.id ? updatedNote : n);
      saveLocalNotes(updatedLocal, userId);
    }

    const isCollectionUuid = !!(updatedNote.collection && UUID_REGEX.test(updatedNote.collection));
    const isTextCategory = !!(
      updatedNote.collection &&
      !isCollectionUuid &&
      updatedNote.collection !== 'unassigned' &&
      updatedNote.collection !== 'general'
    );
    const resolvedCategory = isTextCategory
      ? updatedNote.collection
      : (updatedNote.category || 'Personal');
    const collectionId = isCollectionUuid ? updatedNote.collection : null;

    try {
      if (supabase && userId) {
        const fullUpdate = {
          title: updatedNote.title,
          content: updatedNote.content,
          summary: updatedNote.summary,
          collection_id: collectionId,
          category: resolvedCategory,
          tags: updatedNote.tags,
          pinned: updatedNote.pinned,
        };
        const { error: updErr } = await supabase.from('notes').update(fullUpdate).eq('id', updatedNote.id);
        if (updErr) {
          await supabase.from('notes').update({
            title: updatedNote.title,
            content: updatedNote.content,
          }).eq('id', updatedNote.id);
        }

        if (updatedNote.attachments && updatedNote.attachments.length > 0) {
          await persistAttachmentsIdempotent(supabase, updatedNote.id, userId, updatedNote.attachments);
        }
      }
    } catch (err) {
      console.warn('notesService.updateNote warning:', err);
    }

    return updatedNote;
  },

  async togglePin(noteId: string, currentPinned: boolean, explicitUserId?: string): Promise<boolean> {
    let userId = explicitUserId || null;
    let supabase: any = null;
    try {
      supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) userId = userData.user.id;
    } catch (e) {
      // ignore
    }
    if (!userId) userId = getActiveUserId();

    const newPinned = !currentPinned;
    if (userId) {
      const existing = getLocalNotes(userId);
      saveLocalNotes(existing.map(n => n.id === noteId ? { ...n, pinned: newPinned } : n), userId);
    }

    try {
      if (supabase) {
        await supabase
          .from('notes')
          .update({ pinned: newPinned })
          .eq('id', noteId);
      }
      return newPinned;
    } catch (err) {
      return newPinned;
    }
  },

  async deleteNote(noteId: string, explicitUserId?: string): Promise<{ success: boolean; deletedCount: number; error?: any }> {
    if (!noteId) return { success: false, deletedCount: 0, error: 'No noteId provided' };

    let userId = explicitUserId || null;
    let supabase: any = null;
    try {
      supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) userId = userData.user.id;
    } catch (e) {
      // ignore
    }
    if (!userId) userId = getActiveUserId();

    // 1. Synchronously remove matching note from user-scoped localStorage
    if (userId) {
      const local = getLocalNotes(userId);
      const updatedLocal = local.filter(n => n.id !== noteId);
      saveLocalNotes(updatedLocal, userId);

      // 2. Immediately record persistent deletion tombstone scoped to user
      addTombstoneId(noteId, userId);
    }

    // 3. Delete corresponding records from Supabase tables if authenticated
    try {
      if (!supabase) supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return { success: true, deletedCount: 1 };
      }

      await supabase.from('tasks').delete().eq('note_id', noteId);
      await supabase.from('attachments').delete().eq('note_id', noteId);
      
      const { error, count } = await supabase
        .from('notes')
        .delete({ count: 'exact' })
        .eq('id', noteId);

      if (error || typeof count !== 'number' || count === 0) {
        if (error) {
          console.error('[notesService.deleteNote] Supabase deletion error:', error);
        } else {
          console.warn(`[notesService.deleteNote] Supabase deletion unconfirmed (count: ${count}). Keeping tombstone.`);
        }
        // KEEP tombstone so fetchNotes() will never resurrect this note
        return { success: false, deletedCount: 0, error };
      }

      console.log(`[notesService.deleteNote] Supabase deleted note ${noteId}, exact count:`, count);
      // Remotely confirmed deletion: remove tombstone only when count > 0
      if (userId) {
        removeTombstoneId(noteId, userId);
      }
      return { success: true, deletedCount: count };
    } catch (err) {
      console.warn('[notesService.deleteNote] DB deletion exception:', err);
      // KEEP tombstone so fetchNotes() will never resurrect this note
      return { success: false, deletedCount: 0, error: err };
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    if (!taskId) return;
    try {
      if (UUID_REGEX.test(taskId)) {
        const supabase = createClient() as any;
        await supabase.from('tasks').delete().eq('id', taskId);
      }
    } catch (err) {
      console.warn('[notesService.deleteTask] DB deletion exception:', err);
    }
  },
};
