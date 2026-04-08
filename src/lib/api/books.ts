import { supabase } from '@/integrations/supabase/client';
import type { Book, UserLibraryItem, Bookmark, Highlight, UserRating } from '@/types/book';

// Transform database row to Book type
function transformBook(row: any): Book {
  return {
    id: row.id,
    external_id: row.external_id,
    source: row.source,
    title: row.title,
    author: row.author,
    description: row.description,
    cover_url: row.cover_url,
    epub_url: row.epub_url,
    subjects: row.subjects,
    language: row.language,
    publication_year: row.publication_year,
    word_count: row.word_count,
    average_rating: Number(row.average_rating) || 0,
    rating_count: row.rating_count || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const booksApi = {
  // Fetch books from external APIs and cache them
  async fetchBooks(params: {
    query?: string;
    source?: 'gutenberg' | 'standard_ebooks' | 'all';
    subject?: string;
    page?: number;
    limit?: number;
  }): Promise<{ books: Book[]; total: number }> {
    // Add a 30-second timeout to the fetch call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-books', {
        body: params,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      if (error) throw error;
      return {
        books: (data.books || []).map(transformBook),
        total: data.total || 0,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  // Get featured books
  async getFeaturedBooks(): Promise<Book[]> {
    const { data, error } = await supabase.functions.invoke('fetch-books', {
      body: { featured: true, limit: 10 },
    });

    if (error) throw error;
    return (data.books || []).map(transformBook);
  },

  // Get a single book by ID
  async getBook(id: string): Promise<Book | null> {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? transformBook(data) : null;
  },

  // Get books by category/subject
  async getBooksBySubject(subject: string, limit = 20): Promise<Book[]> {
    const { data, error } = await supabase.functions.invoke('fetch-books', {
      body: { subject, limit },
    });

    if (error) throw error;
    return (data.books || []).map(transformBook);
  },
};

export const libraryApi = {
  // Get user's library
  async getLibrary(userId: string): Promise<UserLibraryItem[]> {
    const { data, error } = await supabase
      .from('user_library')
      .select(`
        *,
        book:books(*)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((item) => ({
      ...item,
      status: item.status as 'reading' | 'want_to_read' | 'finished',
      book: item.book ? transformBook(item.book) : undefined,
    }));
  },

  // Add book to library
  async addToLibrary(userId: string, bookId: string, status: 'reading' | 'want_to_read' | 'finished' = 'want_to_read') {
    const { data, error } = await supabase
      .from('user_library')
      .upsert({
        user_id: userId,
        book_id: bookId,
        status,
        started_at: status === 'reading' ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,book_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update library item status
  async updateStatus(id: string, status: 'reading' | 'want_to_read' | 'finished') {
    const updates: any = { status };
    if (status === 'reading') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'finished') {
      updates.finished_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('user_library')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update reading progress
  async updateProgress(id: string, progress: number, location?: string) {
    const { data, error } = await supabase
      .from('user_library')
      .update({
        reading_progress: progress,
        current_location: location,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Remove from library
  async removeFromLibrary(id: string) {
    const { error } = await supabase
      .from('user_library')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Check if book is in library
  async isInLibrary(userId: string, bookId: string): Promise<UserLibraryItem | null> {
    const { data, error } = await supabase
      .from('user_library')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return {
      ...data,
      status: data.status as 'reading' | 'want_to_read' | 'finished',
    };
  },
};

export const bookmarksApi = {
  async getBookmarks(userId: string, bookId: string): Promise<Bookmark[]> {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addBookmark(userId: string, bookId: string, location: string, label?: string) {
    const { data, error } = await supabase
      .from('bookmarks')
      .insert({ user_id: userId, book_id: bookId, location, label })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteBookmark(id: string) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const highlightsApi = {
  async getHighlights(userId: string, bookId: string): Promise<Highlight[]> {
    const { data, error } = await supabase
      .from('highlights')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addHighlight(
    userId: string,
    bookId: string,
    cfiRange: string,
    textContent: string,
    color: string = 'yellow',
    note?: string
  ) {
    const { data, error } = await supabase
      .from('highlights')
      .insert({
        user_id: userId,
        book_id: bookId,
        cfi_range: cfiRange,
        text_content: textContent,
        color,
        note,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateHighlight(id: string, updates: { note?: string; color?: string }) {
    const { data, error } = await supabase
      .from('highlights')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteHighlight(id: string) {
    const { error } = await supabase
      .from('highlights')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export const ratingsApi = {
  async getRatings(bookId: string): Promise<UserRating[]> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getUserRating(userId: string, bookId: string): Promise<UserRating | null> {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async rateBook(userId: string, bookId: string, rating: number, review?: string) {
    const { data, error } = await supabase
      .from('user_ratings')
      .upsert({
        user_id: userId,
        book_id: bookId,
        rating,
        review,
      }, { onConflict: 'user_id,book_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteRating(id: string) {
    const { error } = await supabase
      .from('user_ratings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
