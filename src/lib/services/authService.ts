import { createClient } from '../supabase/client';

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'U';
  const cleanName = name.trim();
  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const isRealSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && url.trim().length > 0 && key.trim().length > 0);
};

export const authService = {
  clearInvalidSession() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('memoflow_auth_user');
        // Clear Supabase auth tokens from localStorage without touching user notes/data
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('sb-') || k.includes('auth-token') || k.includes('supabase.auth'))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        // ignore
      }
    }
  },

  getRegisteredUserRegistry(): Record<string, { id: string; email: string; full_name: string; password?: string }> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('memoflow_registered_users_db');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  },

  saveRegisteredUser(email: string, id: string, full_name: string, password?: string) {
    if (typeof window === 'undefined') return;
    try {
      const registry = this.getRegisteredUserRegistry();
      const lowerEmail = email.toLowerCase().trim();
      const existing = registry[lowerEmail] || {};
      registry[lowerEmail] = { 
        id, 
        email: lowerEmail, 
        full_name,
        password: password || existing.password
      };
      localStorage.setItem('memoflow_registered_users_db', JSON.stringify(registry));
    } catch (e) {
      console.warn('Failed to save to user registry:', e);
    }
  },

  async signUp(email: string, password: string, name?: string) {
    const formattedName = name?.trim() || 'User';
    const lowerEmail = email.toLowerCase().trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: lowerEmail,
        password,
        options: {
          data: {
            name: formattedName,
            full_name: formattedName,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw new Error(error.message || 'Signup failed.');
      }

      if (data.user) {
        try {
          await (supabase as any).from('profiles').upsert({
            id: data.user.id,
            email: lowerEmail,
            name: formattedName,
            full_name: formattedName,
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn('Profiles table upsert warning:', profileErr);
        }

        this.saveRegisteredUser(lowerEmail, data.user.id, formattedName, password);
        this.saveLocalUserSession(data.user.id, lowerEmail, formattedName);
      }

      if (data.user && !data.session) {
        return {
          user: data.user,
          session: null,
          requiresConfirmation: true,
          message: 'Confirmation email sent! Please check your inbox to confirm your account.',
        };
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new Error('Network error. Unable to connect to Supabase backend.');
      }
      throw err;
    }
  },

  async signIn(email: string, password: string) {
    const lowerEmail = email.toLowerCase().trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: lowerEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password.');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Email confirmation required. Please check your inbox.');
        }
        throw new Error(error.message || 'Invalid email or password.');
      }

      if (data.user) {
        let resolvedName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;

        try {
          const { data: profileRow } = await (supabase as any)
            .from('profiles')
            .select('name, full_name')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileRow?.full_name || profileRow?.name) {
            resolvedName = profileRow.full_name || profileRow.name;
          } else if (resolvedName) {
            await (supabase as any).from('profiles').upsert({
              id: data.user.id,
              email: lowerEmail,
              name: resolvedName,
              full_name: resolvedName,
              updated_at: new Date().toISOString(),
            });
          }
        } catch (profileErr) {
          console.warn('Profiles fetch warning:', profileErr);
        }

        if (!resolvedName) {
          const registry = this.getRegisteredUserRegistry();
          if (registry[lowerEmail]?.full_name) {
            resolvedName = registry[lowerEmail].full_name;
          }
        }

        if (!resolvedName) {
          resolvedName = 'User';
        }

        this.saveRegisteredUser(lowerEmail, data.user.id, resolvedName, password);
        this.saveLocalUserSession(data.user.id, lowerEmail, resolvedName);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new Error('Network error. Unable to connect to Supabase backend.');
      }
      throw err;
    }
  },

  async signInWithOAuth(provider: 'google' | 'github') {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new Error('Network error. Unable to connect to Supabase OAuth endpoint.');
      }
      throw err;
    }
  },

  async resetPasswordForEmail(email: string) {
    const lowerEmail = email.toLowerCase().trim();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.resetPasswordForEmail(lowerEmail, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback?type=recovery` : undefined,
      });

      if (error) {
        if (error.message.includes('User not found')) {
          throw new Error('User account not found with this email address.');
        }
        throw new Error(error.message || 'Failed to send password reset email.');
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new Error('Network error. Unable to connect to Supabase email service.');
      }
      throw err;
    }
  },

  async signOut() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('memoflow_auth_user');
      }
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('SignOut warning:', err);
    }
  },

  async getSession() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('refresh token') || (error as any).code === 'refresh_token_not_found') {
          this.clearInvalidSession();
          return null;
        }
      }
      if (!error && data.session) return data.session;

      const saved = this.getLocalUserSession();
      if (saved) {
        let name = saved.name;
        if ((!name || !name.trim()) && saved.email?.includes('@')) {
          const prefix = saved.email.split('@')[0].trim();
          name = prefix.split(/[._-]+/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
        return {
          user: {
            id: saved.id,
            email: saved.email,
            user_metadata: { name: name || 'User', full_name: name || 'User' },
          },
        };
      }
      return null;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('refresh token') || err?.code === 'refresh_token_not_found') {
        this.clearInvalidSession();
      }
      return null;
    }
  },

  async getUser() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('refresh token') || (error as any).code === 'refresh_token_not_found') {
          this.clearInvalidSession();
          return null;
        }
      }
      if (!error && data.user) {
        let fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;
        const avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture;

        try {
          const { data: profileRow } = await (supabase as any)
            .from('profiles')
            .select('name, full_name, avatar_url')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileRow?.full_name || profileRow?.name) {
            fullName = profileRow.full_name || profileRow.name;
          } else if (fullName) {
            await (supabase as any).from('profiles').upsert({
              id: data.user.id,
              email: data.user.email,
              name: fullName,
              full_name: fullName,
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          // Ignore DB error
        }

        // If metadata / profile has no name, extract prefix from email
        if (!fullName || !fullName.trim()) {
          const email = (data.user.email || '').toLowerCase().trim();
          if (email.includes('@')) {
            const prefix = email.split('@')[0].trim();
            if (prefix) {
              fullName = prefix
                .split(/[._-]+/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' ');
            }
          }
        }

        if (!fullName || !fullName.trim()) {
          const lowerEmail = (data.user.email || '').toLowerCase().trim();
          const registry = this.getRegisteredUserRegistry();
          if (registry[lowerEmail]?.full_name) {
            fullName = registry[lowerEmail].full_name;
          }
        }

        if (!fullName || !fullName.trim()) {
          const saved = this.getLocalUserSession();
          if (saved?.name) fullName = saved.name;
        }

        const finalName = fullName?.trim() || 'User';

        return {
          ...data.user,
          user_metadata: {
            ...data.user.user_metadata,
            name: finalName,
            full_name: finalName,
            avatar_url: avatarUrl,
          },
        };
      }

      const saved = this.getLocalUserSession();
      if (saved) {
        let name = saved.name;
        if ((!name || !name.trim()) && saved.email?.includes('@')) {
          const prefix = saved.email.split('@')[0].trim();
          name = prefix.split(/[._-]+/).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
        return {
          id: saved.id,
          email: saved.email,
          user_metadata: { name: name || 'User', full_name: name || 'User' },
        };
      }
      return null;
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('refresh token') || err?.code === 'refresh_token_not_found') {
        this.clearInvalidSession();
      }
      return null;
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    try {
      const supabase = createClient();
      return supabase.auth.onAuthStateChange(callback);
    } catch (err) {
      // Fallthrough
    }
    return { data: { subscription: { unsubscribe: () => {} } } };
  },

  saveLocalUserSession(id: string, email: string, name: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('memoflow_auth_user', JSON.stringify({ id, email, name }));
    }
  },

  getLocalUserSession() {
    if (typeof window !== 'undefined') {
      const item = localStorage.getItem('memoflow_auth_user');
      if (item) {
        try {
          return JSON.parse(item);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  },

  async updateProfile(name: string): Promise<{ success: boolean; error?: string }> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Name cannot be empty.' };
    }

    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user) {
        // 1. Update Supabase Auth user metadata
        try {
          await supabase.auth.updateUser({
            data: {
              name: trimmedName,
              full_name: trimmedName,
            },
          });
        } catch (updateErr) {
          console.warn('Supabase auth.updateUser warning:', updateErr);
        }

        // 2. Update profiles table if it exists
        try {
          await (supabase as any).from('profiles').upsert({
            id: user.id,
            email: user.email,
            name: trimmedName,
            full_name: trimmedName,
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn('Supabase profiles update warning:', profileErr);
        }

        // 3. Update registered user registry and local session
        if (user.email) {
          this.saveRegisteredUser(user.email, user.id, trimmedName);
          this.saveLocalUserSession(user.id, user.email, trimmedName);
        }

        return { success: true };
      } else {
        // Fallback for local session if offline
        const saved = this.getLocalUserSession();
        if (saved) {
          this.saveLocalUserSession(saved.id, saved.email, trimmedName);
          if (saved.email) {
            this.saveRegisteredUser(saved.email, saved.id, trimmedName);
          }
          return { success: true };
        }
        return { success: false, error: 'User session not found.' };
      }
    } catch (err: any) {
      console.error('authService.updateProfile error:', err);
      return { success: false, error: err.message || 'Failed to update profile.' };
    }
  },
};
