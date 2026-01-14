import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookData {
  external_id: string;
  source: "gutenberg" | "standard_ebooks";
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  epub_url?: string;
  subjects?: string[];
  language?: string;
  publication_year?: number;
  word_count?: number;
}

// Fetch high-quality cover from Open Library
async function fetchOpenLibraryCover(title: string, author: string): Promise<string | null> {
  try {
    // Search Open Library for the book
    const searchQuery = encodeURIComponent(`${title} ${author}`);
    const searchRes = await fetch(`https://openlibrary.org/search.json?q=${searchQuery}&limit=1`);
    if (!searchRes.ok) return null;
    
    const searchData = await searchRes.json();
    const firstResult = searchData.docs?.[0];
    
    if (firstResult?.cover_i) {
      // Return large cover image
      return `https://covers.openlibrary.org/b/id/${firstResult.cover_i}-L.jpg`;
    }
    
    // Try ISBN-based cover if available
    if (firstResult?.isbn?.[0]) {
      return `https://covers.openlibrary.org/b/isbn/${firstResult.isbn[0]}-L.jpg`;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching Open Library cover:", error);
    return null;
  }
}

// Fetch books from Project Gutenberg
async function fetchGutenbergBooks(query?: string, page = 1, limit = 20): Promise<BookData[]> {
  try {
    const baseUrl = "https://gutendex.com/books";
    const params = new URLSearchParams();
    
    if (query) {
      params.set("search", query);
    }
    params.set("page", page.toString());
    
    const response = await fetch(`${baseUrl}?${params.toString()}`);
    if (!response.ok) {
      console.error("Gutenberg API error:", response.status);
      return [];
    }
    
    const data = await response.json();
    
    const books: BookData[] = [];
    
    for (const book of (data.results || []).slice(0, limit)) {
      // Get EPUB URL - use the direct .epub.images format which works for reading
      const epubUrl = book.formats?.["application/epub+zip"] || null;
      
      // Get author
      const author = book.authors?.length > 0 
        ? book.authors.map((a: any) => a.name).join(", ")
        : "Unknown Author";
      
      const title = book.title || "Untitled";
      
      // Get fallback Gutenberg cover
      const gutenbergCover = book.formats?.["image/jpeg"] || 
                             Object.entries(book.formats || {}).find(([k]) => k.includes("image"))?.[1];
      
      // Try to get high-quality cover from Open Library
      let coverUrl = await fetchOpenLibraryCover(title, author);
      if (!coverUrl) {
        coverUrl = gutenbergCover || null;
      }
      
      books.push({
        external_id: `gutenberg-${book.id}`,
        source: "gutenberg" as const,
        title,
        author,
        description: book.summaries?.[0] || undefined,
        cover_url: coverUrl || undefined,
        epub_url: epubUrl || undefined,
        subjects: book.subjects || [],
        language: book.languages?.[0] || "en",
        publication_year: undefined,
        word_count: undefined,
      });
    }
    
    return books;
  } catch (error) {
    console.error("Error fetching from Gutenberg:", error);
    return [];
  }
}

// Fetch books from Standard Ebooks
async function fetchStandardEbooks(query?: string, limit = 20): Promise<BookData[]> {
  try {
    // Standard Ebooks provides an OPDS feed
    const response = await fetch("https://standardebooks.org/feeds/opds/all");
    if (!response.ok) {
      console.error("Standard Ebooks API error:", response.status);
      return [];
    }
    
    const xml = await response.text();
    
    // Parse XML manually for Deno environment
    const entries: BookData[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(xml)) !== null && entries.length < limit) {
      const entry = match[1];
      
      // Extract fields
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
      const idMatch = entry.match(/<id>([^<]+)<\/id>/);
      const summaryMatch = entry.match(/<summary[^>]*>([^<]+)<\/summary>/);
      const coverMatch = entry.match(/href="([^"]+)"[^>]*type="image\/jpeg"/);
      const epubMatch = entry.match(/href="([^"]+)"[^>]*type="application\/epub\+zip"/);
      
      const title = titleMatch?.[1] || "";
      const author = authorMatch?.[1] || "Unknown Author";
      
      // Filter by query if provided
      if (query) {
        const q = query.toLowerCase();
        if (!title.toLowerCase().includes(q) && !author.toLowerCase().includes(q)) {
          continue;
        }
      }
      
      entries.push({
        external_id: `standard-${idMatch?.[1] || Math.random().toString(36)}`,
        source: "standard_ebooks",
        title,
        author,
        description: summaryMatch?.[1] || undefined,
        cover_url: coverMatch?.[1] || undefined,
        epub_url: epubMatch?.[1] || undefined,
        subjects: [],
        language: "en",
      });
    }
    
    return entries;
  } catch (error) {
    console.error("Error fetching from Standard Ebooks:", error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, source = "all", subject, page = 1, limit = 20, featured = false } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let books: BookData[] = [];
    
    // For featured, get a curated selection
    if (featured) {
      // First check if we have cached books
      const { data: cachedBooks } = await supabase
        .from("books")
        .select("*")
        .order("average_rating", { ascending: false })
        .limit(limit);
      
      if (cachedBooks && cachedBooks.length >= limit) {
        return new Response(
          JSON.stringify({ books: cachedBooks, total: cachedBooks.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fetch popular classics from Gutenberg
      const gutenbergBooks = await fetchGutenbergBooks("", 1, limit);
      books = gutenbergBooks;
    } else {
      // Fetch based on source
      if (source === "all" || source === "gutenberg") {
        const gutenbergBooks = await fetchGutenbergBooks(query, page, limit);
        books = [...books, ...gutenbergBooks];
      }
      
      if (source === "all" || source === "standard_ebooks") {
        const seBooks = await fetchStandardEbooks(query, limit);
        books = [...books, ...seBooks];
      }
    }

    // Upsert books to cache
    if (books.length > 0) {
      for (const book of books) {
        await supabase
          .from("books")
          .upsert(book, { onConflict: "external_id" })
          .select();
      }
    }

    // Fetch from cache to get IDs
    const externalIds = books.map(b => b.external_id);
    const { data: cachedBooks } = await supabase
      .from("books")
      .select("*")
      .in("external_id", externalIds);

    return new Response(
      JSON.stringify({ 
        books: cachedBooks || books, 
        total: cachedBooks?.length || books.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in fetch-books function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
