-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Creations Table (Base Table)
CREATE TABLE public.creations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nullable for anonymous
  type text NOT NULL CHECK (type IN ('story', 'lesson')),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  english_title text,
  description text,
  is_public boolean DEFAULT false,
  rating_avg float DEFAULT 0,
  rating_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_creations_slug ON public.creations(slug);
CREATE INDEX idx_creations_owner_id ON public.creations(owner_id);

-- 3. Stories Table
CREATE TABLE public.stories (
  id uuid REFERENCES public.creations(id) ON DELETE CASCADE PRIMARY KEY,
  content text NOT NULL,
  child_name text,
  age int,
  gender text,
  purpose text,
  education_category text,
  duration_mins int,
  language text DEFAULT 'en',
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 4. Lessons Table
CREATE TABLE public.lessons (
  id uuid REFERENCES public.creations(id) ON DELETE CASCADE PRIMARY KEY,
  content text NOT NULL,
  topic text,
  level text,
  tone text,
  duration_mins int,
  language text DEFAULT 'en'
);

-- 5. Assets Table
CREATE TABLE public.assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creation_id uuid REFERENCES public.creations(id) ON DELETE CASCADE NOT NULL,
  asset_type text NOT NULL, -- 'image_main', 'audio_narration'
  storage_path text NOT NULL,
  public_url text,
  provider text,
  created_at timestamptz DEFAULT now()
);

-- 6. Tags Table
CREATE TABLE public.tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  category text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tags_slug ON public.tags(slug);

-- 7. Creation Tags (Join Table)
CREATE TABLE public.creation_tags (
  creation_id uuid REFERENCES public.creations(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (creation_id, tag_id)
);

-- 8. Favorites Table
CREATE TABLE public.favorites (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  creation_id uuid REFERENCES public.creations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, creation_id)
);

--- Row-Level Security (RLS) ---

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Creations: Public can see public creations; Owners can see/do anything with their own
CREATE POLICY "Public can view public creations" ON public.creations FOR SELECT USING (is_public = true);
CREATE POLICY "Owners can view own creations" ON public.creations FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Allow any insert" ON public.creations FOR INSERT WITH CHECK (true);
CREATE POLICY "Owners can update own creations" ON public.creations FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete own creations" ON public.creations FOR DELETE USING (auth.uid() = owner_id);

-- Stories/Lessons/Assets: Inherit from creations
CREATE POLICY "View stories of public/owned creations" ON public.stories FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.creations c WHERE c.id = stories.id AND (c.is_public = true OR c.owner_id = auth.uid())));

CREATE POLICY "View lessons of public/owned creations" ON public.lessons FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.creations c WHERE c.id = lessons.id AND (c.is_public = true OR c.owner_id = auth.uid())));

CREATE POLICY "View assets of public/owned creations" ON public.assets FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.creations c WHERE c.id = assets.creation_id AND (c.is_public = true OR c.owner_id = auth.uid())));

-- Tags: Publicly readable
CREATE POLICY "Anyone can view tags" ON public.tags FOR SELECT USING (true);

-- Favorites: Owner only
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);

--- Triggers ---

-- Automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_updated_at_creations BEFORE UPDATE ON public.creations FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
