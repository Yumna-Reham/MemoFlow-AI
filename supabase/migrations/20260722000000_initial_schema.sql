-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================
-- 1. PROFILES TABLE & USER TRIGGER
-- ========================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automatic Profile Creation Trigger for Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, full_name, avatar_url, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- 2. COLLECTIONS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cover_gradient TEXT DEFAULT 'from-blue-600 to-indigo-600',
    item_count INT DEFAULT 0,
    progress INT DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- 3. NOTES TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'note', -- 'note' | 'screenshot' | 'pdf' | 'voice' | 'image' | 'website' | 'link' | 'youtube' | 'chatgpt' | 'whatsapp'
    content TEXT NOT NULL,
    summary TEXT,
    category TEXT DEFAULT 'Personal',
    takeaways TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    saved_date DATE DEFAULT CURRENT_DATE,
    saved_time TEXT,
    pinned BOOLEAN DEFAULT FALSE,
    cover_image TEXT,
    original_url TEXT,
    audio_duration TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- 4. TASKS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- 5. TAGS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ========================================================
-- 6. ATTACHMENTS TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================================
-- INDEXES FOR PERFORMANCE
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON public.notes(collection_id);
CREATE INDEX IF NOT EXISTS idx_tasks_note_id ON public.tasks(note_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON public.attachments(note_id);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Collections Policies
CREATE POLICY "Users can manage own collections" ON public.collections FOR ALL USING (auth.uid() = user_id);

-- Notes Policies
CREATE POLICY "Users can manage own notes" ON public.notes FOR ALL USING (auth.uid() = user_id);

-- Tasks Policies
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- Tags Policies
CREATE POLICY "Users can manage own tags" ON public.tags FOR ALL USING (auth.uid() = user_id);

-- Attachments Policies
CREATE POLICY "Users can manage own attachments" ON public.attachments FOR ALL USING (auth.uid() = user_id);

-- ========================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- 7. SUPABASE STORAGE BUCKET & POLICIES
-- ========================================================
-- 7. SUPABASE STORAGE BUCKET & PER-USER POLICIES (PRIVATE)
-- ========================================================
-- Ensure private 'memoflow-files' bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memoflow-files', 'memoflow-files', false, 52428800, null)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

-- Drop any old/insecure policies idempotently
DROP POLICY IF EXISTS "Public Access to memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates to memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes to memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read for memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files in memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files in memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own objects in memoflow-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own objects in memoflow-files" ON storage.objects;

-- SELECT: Authenticated user can read ONLY their own objects
CREATE POLICY "Users can read own objects in memoflow-files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'memoflow-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- INSERT: Authenticated user can upload ONLY into their own folder (<user_id>/...)
CREATE POLICY "Users can insert own objects in memoflow-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'memoflow-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- UPDATE: Authenticated user can update ONLY their own objects
CREATE POLICY "Users can update own files in memoflow-files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'memoflow-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'memoflow-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- DELETE: Authenticated user can delete ONLY their own objects
CREATE POLICY "Users can delete own files in memoflow-files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'memoflow-files'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

