import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/services/aiService';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { message, notes: clientNotes, imageBase64, imageMime, activeNote } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let notesToUse = clientNotes || [];

    // Only query Supabase as a fallback if the client did NOT provide notes
    if (!Array.isArray(notesToUse) || notesToUse.length === 0) {
      try {
        const cookieStore = await cookies();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
              getAll() { return cookieStore.getAll(); },
              setAll(cookiesToSet) {
                try {
                  cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                } catch {}
              }
            }
          });

          // Fetch only required lightweight text columns, avoid heavy attachments, and limit to top 20
          const { data: dbNotes } = await supabase
            .from('notes')
            .select('id, title, type, content, summary, takeaways, category, tags, saved_date')
            .order('created_at', { ascending: false })
            .limit(20);

          if (dbNotes && dbNotes.length > 0) {
            notesToUse = dbNotes.map((n: any) => ({
              id: n.id,
              title: n.title || 'Untitled',
              type: n.type || 'note',
              content: n.content || '',
              summary: n.summary || '',
              takeaways: n.takeaways || [],
              category: n.category || 'Personal',
              tags: n.tags || [],
              savedDate: n.saved_date || new Date().toISOString().split('T')[0],
            }));
          }
        }
      } catch (dbErr) {
        console.warn('[API /api/chat] Supabase notes fetch warning, using client notes fallback:', dbErr);
      }
    }

    // Call centralized AI service RAG chat engine (with optional active note context + image)
    const result = await aiService.queryMemoryChat(message, notesToUse, imageBase64, imageMime, activeNote);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API /api/chat] Error:', error);
    const errStr = error?.message || String(error);
    const isQuota = errStr.includes('429') || errStr.toLowerCase().includes('quota') || errStr.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return NextResponse.json({
        answer: "AI is temporarily rate-limited. Please try again in a moment.",
        citations: []
      });
    }

    return NextResponse.json(
      { error: errStr || 'Internal server error processing chat' },
      { status: 500 }
    );
  }
}
