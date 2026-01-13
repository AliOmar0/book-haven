export interface Book {
  id: string;
  external_id: string;
  source: 'gutenberg' | 'standard_ebooks';
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  epub_url?: string;
  subjects?: string[];
  language?: string;
  publication_year?: number;
  word_count?: number;
  average_rating: number;
  rating_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserLibraryItem {
  id: string;
  user_id: string;
  book_id: string;
  status: 'reading' | 'want_to_read' | 'finished';
  reading_progress: number;
  current_location?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
  book?: Book;
}

export interface Bookmark {
  id: string;
  user_id: string;
  book_id: string;
  location: string;
  label?: string;
  created_at?: string;
}

export interface Highlight {
  id: string;
  user_id: string;
  book_id: string;
  cfi_range: string;
  text_content: string;
  note?: string;
  color: string;
  created_at?: string;
}

export interface UserRating {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  review?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReadingPreferences {
  theme: 'light' | 'dark' | 'sepia';
  font_size: number;
  font_family: 'serif' | 'sans-serif' | 'mono';
  line_spacing: number;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  avatar_url?: string;
  reading_preferences: ReadingPreferences;
  created_at?: string;
  updated_at?: string;
}
