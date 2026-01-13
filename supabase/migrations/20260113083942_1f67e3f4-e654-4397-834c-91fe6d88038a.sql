-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    reading_preferences JSONB DEFAULT '{"theme": "light", "font_size": 16, "font_family": "serif"}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Create books cache table to store fetched book metadata
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK (source IN ('gutenberg', 'standard_ebooks')),
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    epub_url TEXT,
    subjects TEXT[],
    language TEXT DEFAULT 'en',
    publication_year INTEGER,
    word_count INTEGER,
    average_rating NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on books (public read, only system can write)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view books"
ON public.books FOR SELECT
USING (true);

-- Create user library table
CREATE TABLE public.user_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'want_to_read' CHECK (status IN ('reading', 'want_to_read', 'finished')),
    reading_progress NUMERIC(5,2) DEFAULT 0,
    current_location TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, book_id)
);

-- Enable RLS on user_library
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own library"
ON public.user_library FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their library"
ON public.user_library FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their library"
ON public.user_library FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove from their library"
ON public.user_library FOR DELETE
USING (auth.uid() = user_id);

-- Create bookmarks table
CREATE TABLE public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    location TEXT NOT NULL,
    label TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their bookmarks"
ON public.bookmarks FOR ALL
USING (auth.uid() = user_id);

-- Create highlights table
CREATE TABLE public.highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    cfi_range TEXT NOT NULL,
    text_content TEXT NOT NULL,
    note TEXT,
    color TEXT DEFAULT 'yellow',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their highlights"
ON public.highlights FOR ALL
USING (auth.uid() = user_id);

-- Create user ratings table
CREATE TABLE public.user_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, book_id)
);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings"
ON public.user_ratings FOR SELECT
USING (true);

CREATE POLICY "Users can manage their ratings"
ON public.user_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their ratings"
ON public.user_ratings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their ratings"
ON public.user_ratings FOR DELETE
USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_books_updated_at
BEFORE UPDATE ON public.books
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_library_updated_at
BEFORE UPDATE ON public.user_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_ratings_updated_at
BEFORE UPDATE ON public.user_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update book average rating
CREATE OR REPLACE FUNCTION public.update_book_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.books
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 0) 
            FROM public.user_ratings 
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        ),
        rating_count = (
            SELECT COUNT(*) 
            FROM public.user_ratings 
            WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)
        )
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_book_rating_on_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_book_rating();