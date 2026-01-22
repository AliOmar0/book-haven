import { useQuery } from '@tanstack/react-query';
import { booksApi } from '@/lib/api/books';
import type { Book } from '@/types/book';

// Cache time constants
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

export function useFeaturedBooks() {
  return useQuery({
    queryKey: ['books', 'featured'],
    queryFn: () => booksApi.getFeaturedBooks(),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useBooksBySubject(subject: string, limit = 10) {
  return useQuery({
    queryKey: ['books', 'subject', subject, limit],
    queryFn: () => booksApi.getBooksBySubject(subject, limit),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!subject,
  });
}

export function useSearchBooks(params: {
  query?: string;
  source?: 'gutenberg' | 'standard_ebooks' | 'all';
  subject?: string;
  page?: number;
  limit?: number;
}) {
  const hasParams = params.query || (params.source && params.source !== 'all') || params.subject;
  
  return useQuery({
    queryKey: ['books', 'search', params],
    queryFn: () => booksApi.fetchBooks(params),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!hasParams,
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ['books', id],
    queryFn: () => booksApi.getBook(id),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!id,
  });
}

// Categories for browsing
export const BOOK_CATEGORIES = [
  { id: 'fiction', label: 'Fiction', subject: 'Fiction' },
  { id: 'adventure', label: 'Adventure', subject: 'Adventure' },
  { id: 'romance', label: 'Romance', subject: 'Love stories' },
  { id: 'mystery', label: 'Mystery', subject: 'Detective and mystery stories' },
  { id: 'science-fiction', label: 'Science Fiction', subject: 'Science fiction' },
  { id: 'philosophy', label: 'Philosophy', subject: 'Philosophy' },
  { id: 'history', label: 'History', subject: 'History' },
  { id: 'poetry', label: 'Poetry', subject: 'Poetry' },
] as const;
