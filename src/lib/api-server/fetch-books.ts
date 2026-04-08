import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reuse the logic from the edge function, adapted for Node/Vite
export default async function handleFetchBooks(req: any, res: any) {
  try {
    const body = req.body;
    const { query, source = "all", subject, page = 1, limit = 20, featured = false } = body;

    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let books: any[] = [];
    
    // We'll implement a simplified version of the logic here for the local dev server
    // For now, let's fetch from Gutenberg primarily
    if (featured || !query && !subject) {
       // Just fetch popular from Gutenberg
       books = await fetchGutenbergBooks("", 1, limit);
    } else {
       books = await fetchGutenbergBooks(query, page, limit, subject);
    }

    // Return the response
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ books, total: books.length }));

  } catch (error: any) {
    console.error("Error in local fetch-books:", error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function fetchGutenbergBooks(query?: string, page = 1, limit = 20, topic?: string) {
  const baseUrl = "https://gutendex.com/books";
  const params = new URLSearchParams();
  if (query) params.set("search", query);
  if (topic) params.set("topic", topic);
  params.set("page", page.toString());

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  const data: any = await response.json();
  
  return (data.results || []).slice(0, limit).map((book: any) => ({
    id: `gutenberg-${book.id}`,
    external_id: `gutenberg-${book.id}`,
    source: "gutenberg",
    title: book.title,
    author: book.authors?.[0]?.name || "Unknown Author",
    cover_url: book.formats?.["image/jpeg"],
    epub_url: book.formats?.["application/epub+zip"],
    subjects: book.subjects || [],
    language: book.languages?.[0] || "en",
  }));
}
