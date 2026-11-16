import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder';

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return response;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    });

    const getUserPromise = supabase.auth.getUser().then(async ({ data, error }) => {
      if (error) {
        const msg = (error.message || '').toLowerCase();
        const code = (error as any).code || '';
        if (msg.includes('refresh token') || code === 'refresh_token_not_found') {
          // Clear stale auth cookies through existing SSR cookie mechanism
          const allCookies = request.cookies.getAll();
          for (const c of allCookies) {
            if (c.name.startsWith('sb-') || c.name.includes('auth-token')) {
              request.cookies.delete(c.name);
              response.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 });
            }
          }
        }
      }
      return data;
    }).catch(async (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      const code = err?.code || '';
      if (msg.includes('refresh token') || code === 'refresh_token_not_found') {
        const allCookies = request.cookies.getAll();
        for (const c of allCookies) {
          if (c.name.startsWith('sb-') || c.name.includes('auth-token')) {
            request.cookies.delete(c.name);
            response.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 });
          }
        }
      }
      return null;
    });

    await Promise.race([
      getUserPromise,
      new Promise(resolve => setTimeout(resolve, 300))
    ]);
  } catch (err) {
    // Gracefully handle unconfigured or unreachable Supabase endpoints in proxy
  }

  return response;
}
