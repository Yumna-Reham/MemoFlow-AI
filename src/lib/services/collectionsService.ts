import { createClient } from '../supabase/client';
import { Collection, Note } from '@/mockData';

export interface EnhancedCollection extends Collection {
  description?: string;
  icon?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'memoflow_custom_collections';

export const DEFAULT_COLLECTIONS: EnhancedCollection[] = [
  {
    id: 'col-personal',
    name: 'Personal',
    description: 'Personal notes, thoughts, and lifestyle memories.',
    coverGradient: 'from-sky-500 via-blue-600 to-indigo-700',
    itemCount: 0,
    progress: 0,
    color: '#3B82F6',
    icon: '📌',
    updatedAt: 'Recently'
  },
  {
    id: 'col-office',
    name: 'Office',
    description: 'Work projects, meeting minutes, sprint goals, and deliverables.',
    coverGradient: 'from-emerald-500 via-teal-600 to-indigo-900',
    itemCount: 0,
    progress: 0,
    color: '#10B981',
    icon: '💼',
    updatedAt: 'Recently'
  },
  {
    id: 'col-university',
    name: 'University',
    description: 'Lecture notes, assignments, coursework, and academic research.',
    coverGradient: 'from-violet-600 via-purple-600 to-cyan-500',
    itemCount: 0,
    progress: 0,
    color: '#8B5CF6',
    icon: '🎓',
    updatedAt: 'Recently'
  },
  {
    id: 'col-research',
    name: 'Research',
    description: 'Deep dives, literature reviews, whitepapers, and study notes.',
    coverGradient: 'from-rose-500 via-fuchsia-600 to-purple-700',
    itemCount: 0,
    progress: 0,
    color: '#F43F5E',
    icon: '🔬',
    updatedAt: 'Recently'
  }
];

export function autoInferCollection(title: string, content: string = '', filename?: string): string {
  const text = `${title} ${content} ${filename || ''}`.toLowerCase();

  if (/\b(lab|react|lecture|assignment|exam|university|course|homework|syllabus|professor|gpa)\b/i.test(text)) {
    return 'University';
  }
  if (/\b(memoflow|ui|codebase|feature|bug|component|nextjs|tailwindcss|pr|repo|commit)\b/i.test(text)) {
    return 'MemoFlow';
  }
  if (/\b(paper|llm|benchmark|transformer|arxiv|dataset|embedding|vector|neural|research|study)\b/i.test(text)) {
    return 'Research';
  }
  if (/\b(office|work|meeting|sprint|jira|client|invoice|stakeholder|quarterly|roadmap)\b/i.test(text)) {
    return 'Office';
  }
  if (/\b(book|journal|personal|diary|habit|workout|fitness|recipe|health)\b/i.test(text)) {
    return 'Personal';
  }

  return 'Uncategorized'; // Unassigned / Inbox
}

export function isNoteInCollection(note: Note, collectionIdentifier: string | Collection): boolean {
  if (!note) return false;

  // 1. Extract target collection identifier and clean name
  const rawTargetName = typeof collectionIdentifier === 'string' 
    ? collectionIdentifier 
    : (collectionIdentifier.name || collectionIdentifier.id || '');
    
  const targetId = (typeof collectionIdentifier === 'string'
    ? collectionIdentifier
    : collectionIdentifier.id || '').trim().toLowerCase();

  const targetName = rawTargetName.replace(/^[^\w\s]+\s*/, '').trim().toLowerCase();
  const targetIdWithoutPrefix = targetId.startsWith('col-') ? targetId.slice(4).trim() : '';

  // 2. Determine single effective collection for the note using strict priority:
  // Priority: note.collection -> note.category -> note.context_category -> 'Unassigned'
  const colVal = (note.collection || '').trim();
  const isColValid = colVal && colVal.toLowerCase() !== 'unassigned' && colVal.toLowerCase() !== 'general' && colVal.toLowerCase() !== 'none';

  const catVal = (note.category || '').trim();
  const isCatValid = catVal && catVal.toLowerCase() !== 'unassigned' && catVal.toLowerCase() !== 'general' && catVal.toLowerCase() !== 'none';

  const contextCatVal = (((note as any).context_category || (note as any).metadata?.context_category || '') as string).trim();
  const isContextCatValid = contextCatVal && contextCatVal.toLowerCase() !== 'unassigned' && contextCatVal.toLowerCase() !== 'general' && contextCatVal.toLowerCase() !== 'none';

  const effectiveCollection = isColValid
    ? colVal
    : isCatValid
    ? catVal
    : isContextCatValid
    ? contextCatVal
    : 'Unassigned';

  const effectiveClean = effectiveCollection.toLowerCase().trim();

  // 3. Unassigned / Uncategorized / Inbox container handling
  const isTargetUnassigned = targetName === 'unassigned' || targetName === 'uncategorized' || targetName === 'inbox' ||
                             targetId === 'col-unassigned' || targetId === 'col-uncategorized' || targetId === 'col-inbox';

  if (isTargetUnassigned) {
    return effectiveClean === 'unassigned' || effectiveClean === 'uncategorized' || effectiveClean === 'inbox';
  }

  // 4. Exact case-insensitive comparison against target collection name or id
  // STRICT RULE: Never check note.tags and never use substring includes()
  return (
    effectiveClean === targetName ||
    effectiveClean === targetId ||
    (targetIdWithoutPrefix !== '' && effectiveClean === targetIdWithoutPrefix)
  );
}

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

function getCollectionsStorageKey(userId?: string | null): string | null {
  const uid = userId || getActiveUserId();
  return uid ? `memoflow_custom_collections_${uid}` : null;
}

export const collectionsService = {
  getStoredCollections(userId?: string | null): EnhancedCollection[] {
    if (typeof window === 'undefined') return [];
    const key = getCollectionsStorageKey(userId);
    if (!key) return [];
    try {
      const rawScoped = localStorage.getItem(key);
      if (rawScoped) {
        return JSON.parse(rawScoped);
      }
      // Migration for active authenticated user from legacy global key
      const rawLegacy = localStorage.getItem('memoflow_custom_collections');
      if (rawLegacy) {
        try {
          const parsed = JSON.parse(rawLegacy);
          if (Array.isArray(parsed)) {
            localStorage.setItem(key, JSON.stringify(parsed));
            localStorage.removeItem('memoflow_custom_collections');
            return parsed;
          }
        } catch (e) {}
      }
      return [];
    } catch (err) {
      console.warn('Failed to parse stored collections from localStorage:', err);
      return [];
    }
  },

  saveStoredCollections(list: EnhancedCollection[], userId?: string | null) {
    if (typeof window === 'undefined') return;
    const key = getCollectionsStorageKey(userId);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to save collections to localStorage:', err);
    }
  },

  async fetchCollections(explicitUserId?: string): Promise<EnhancedCollection[]> {
    let activeUserId = explicitUserId || null;
    let remoteCollections: EnhancedCollection[] = [];
    try {
      const supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        activeUserId = userData.user.id;
        const { data: rawCollections, error } = await supabase
          .from('collections')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && rawCollections) {
          remoteCollections = (rawCollections as any[]).map(c => ({
            id: c.id,
            name: c.name,
            description: c.description || 'Organized topic folder.',
            coverGradient: c.cover_gradient || 'from-violet-600 to-indigo-600',
            itemCount: 0,
            progress: 0,
            color: c.color || '#8B5CF6',
            icon: c.icon || '📁',
            updatedAt: 'Recently'
          }));
        }
      }
    } catch (err) {
      console.warn('collectionsService.fetchCollections Supabase warning:', err);
    }

    if (!activeUserId) {
      activeUserId = getActiveUserId();
    }

    if (!activeUserId) {
      return [];
    }

    const localSaved = this.getStoredCollections(activeUserId);

    // Combine DEFAULT_COLLECTIONS + localSaved + remoteCollections without duplicates
    const collectionMap = new Map<string, EnhancedCollection>();

    DEFAULT_COLLECTIONS.forEach(col => collectionMap.set(col.id, col));
    localSaved.forEach(col => collectionMap.set(col.id, col));
    remoteCollections.forEach(col => collectionMap.set(col.id, col));

    const combined = Array.from(collectionMap.values());
    this.saveStoredCollections(combined, activeUserId);
    return combined;
  },

  async createCollection(
    name: string, 
    description?: string, 
    icon?: string, 
    coverGradient?: string, 
    color?: string,
    explicitUserId?: string
  ): Promise<EnhancedCollection> {
    const cleanName = name.trim();
    const newCol: EnhancedCollection = {
      id: `col-${Date.now()}`,
      name: cleanName,
      description: description || 'Organized topic cluster deck.',
      coverGradient: coverGradient || 'from-violet-600 to-indigo-600',
      itemCount: 0,
      progress: 0,
      color: color || '#8B5CF6',
      icon: icon || '📁',
      updatedAt: 'Just now'
    };

    let activeUserId = explicitUserId || null;

    // Try Supabase insert
    try {
      const supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        activeUserId = userData.user.id;
        const payload = {
          user_id: userData.user.id,
          name: cleanName,
          description: description || 'Organized topic cluster deck.',
          icon: icon || '📁',
          cover_gradient: coverGradient || 'from-violet-600 to-indigo-600',
          item_count: 0,
          progress: 0,
          color: color || '#8B5CF6',
        };

        const { data: created, error } = await supabase
          .from('collections')
          .insert(payload)
          .select()
          .single();

        if (!error && created) {
          newCol.id = created.id;
        }
      }
    } catch (err) {
      console.warn('Supabase collection insert warning (falling back to local storage):', err);
    }

    if (!activeUserId) {
      activeUserId = getActiveUserId();
    }

    // Always persist to user-scoped localStorage
    if (activeUserId) {
      const current = this.getStoredCollections(activeUserId);
      const updated = [newCol, ...current.filter(c => c.id !== newCol.id)];
      this.saveStoredCollections(updated, activeUserId);
    }

    return newCol;
  },

  async deleteCollection(id: string, explicitUserId?: string): Promise<boolean> {
    let activeUserId = explicitUserId || null;
    // Try Supabase delete
    try {
      const supabase = createClient() as any;
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        activeUserId = userData.user.id;
        await supabase.from('collections').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Supabase collection delete warning:', err);
    }

    if (!activeUserId) {
      activeUserId = getActiveUserId();
    }

    // Delete from user-scoped localStorage
    if (activeUserId) {
      const current = this.getStoredCollections(activeUserId);
      const updated = current.filter(c => c.id !== id);
      this.saveStoredCollections(updated, activeUserId);
    }

    return true;
  }
};
