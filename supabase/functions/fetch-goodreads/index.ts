import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoodreadsReview {
  rating: number;
  text: string;
  author: string;
  date: string;
}

interface GoodreadsData {
  rating: number | null;
  ratingsCount: number | null;
  reviewsCount: number | null;
  reviews: GoodreadsReview[];
  goodreadsUrl: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, author } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: "Title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY") || Deno.env.get("FIRECRAWL_API_KEY_1");
    if (!firecrawlApiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Firecrawl's search API to find the book on Goodreads
    const searchQuery = `${title} ${author || ""} site:goodreads.com/book/show`;
    
    console.log("Searching for Goodreads book:", searchQuery);

    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 1,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Firecrawl search API error:", searchResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to search for book" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    console.log("Search results:", JSON.stringify(searchData).substring(0, 500));

    // Get the first Goodreads book URL
    const results = searchData.data || [];
    const goodreadsResult = results.find((r: any) => 
      r.url && r.url.includes("goodreads.com/book/show")
    );

    if (!goodreadsResult) {
      console.log("No Goodreads book found in search results");
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            rating: null,
            ratingsCount: null,
            reviewsCount: null,
            reviews: [],
            goodreadsUrl: null,
          } as GoodreadsData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookUrl = goodreadsResult.url;
    console.log("Found book URL:", bookUrl);

    // Now scrape the book page for ratings and reviews
    const bookResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: bookUrl,
        formats: ["html", "markdown"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!bookResponse.ok) {
      console.error("Firecrawl book page API error:", bookResponse.status);
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { rating: null, ratingsCount: null, reviewsCount: null, reviews: [], goodreadsUrl: bookUrl } 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bookData = await bookResponse.json();
    const bookHtml = bookData.data?.html || bookData.html || "";
    const bookMarkdown = bookData.data?.markdown || bookData.markdown || "";

    console.log("Scraped book page, HTML length:", bookHtml.length, "Markdown length:", bookMarkdown.length);

    // Extract rating (Goodreads uses various patterns)
    let rating: number | null = null;
    let ratingsCount: number | null = null;
    let reviewsCount: number | null = null;

    // Try to extract rating from aria-label or rating value patterns
    const ratingPatterns = [
      /aria-label="Rating (\d+(?:\.\d+)?) out of 5"/i,
      /class="RatingStatistics__rating"[^>]*>(\d+(?:\.\d+)?)</i,
      /itemprop="ratingValue"[^>]*content="(\d+(?:\.\d+)?)"/i,
      /"ratingValue"\s*:\s*"?(\d+(?:\.\d+)?)"?/i,
      /(\d+\.\d{2})\s*<\/div>\s*<\/div>\s*<p[^>]*>[\d,]+\s*ratings/i,
      /Rating\s*(\d+(?:\.\d+)?)\s*out of 5/i,
    ];

    for (const pattern of ratingPatterns) {
      const match = bookHtml.match(pattern) || bookMarkdown.match(pattern);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (parsed > 0 && parsed <= 5) {
          rating = parsed;
          console.log("Found rating:", rating);
          break;
        }
      }
    }

    // Extract ratings count
    const ratingsCountPatterns = [
      /([\d,]+)\s*ratings/i,
      /(\d{1,3}(?:,\d{3})*)\s*rating/i,
      /"ratingCount"\s*:\s*"?(\d+)"?/i,
    ];

    for (const pattern of ratingsCountPatterns) {
      const match = bookHtml.match(pattern) || bookMarkdown.match(pattern);
      if (match) {
        ratingsCount = parseInt(match[1].replace(/,/g, ""), 10);
        console.log("Found ratings count:", ratingsCount);
        break;
      }
    }

    // Extract reviews count
    const reviewsCountPatterns = [
      /([\d,]+)\s*reviews/i,
      /"reviewCount"\s*:\s*"?(\d+)"?/i,
    ];

    for (const pattern of reviewsCountPatterns) {
      const match = bookHtml.match(pattern) || bookMarkdown.match(pattern);
      if (match) {
        reviewsCount = parseInt(match[1].replace(/,/g, ""), 10);
        console.log("Found reviews count:", reviewsCount);
        break;
      }
    }

    // Extract reviews from markdown (more reliable than HTML parsing)
    const reviews: GoodreadsReview[] = [];

    // Look for review patterns - reviews on Goodreads often have star ratings followed by dates and text
    // Pattern: Look for review content blocks with ratings
    const reviewPattern = /(\d)\s*stars?\s*\n[\s\S]*?(\d{4})\n+(.{100,800}?)(?=\n\n\d\s*stars?|\n\n\*\s*\*\s*\*|$)/gi;
    let reviewMatch;
    
    while ((reviewMatch = reviewPattern.exec(bookMarkdown)) !== null && reviews.length < 5) {
      const reviewRating = parseInt(reviewMatch[1], 10);
      const reviewText = reviewMatch[3]
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/\n{2,}/g, "\n")
        .replace(/likes\s*\d+\s*comments?/gi, "")
        .replace(/Profile Image for.*$/gi, "")
        .trim();
      
      if (reviewText.length > 80 && reviewRating >= 1 && reviewRating <= 5) {
        reviews.push({
          rating: reviewRating,
          text: reviewText.substring(0, 600),
          author: "Goodreads Reader",
          date: "",
        });
      }
    }

    // Fallback: Try to extract from quoted text in markdown
    if (reviews.length === 0) {
      const quotePattern = />\s*_"([^"]+)"_/g;
      let quoteMatch;
      
      while ((quoteMatch = quotePattern.exec(bookMarkdown)) !== null && reviews.length < 3) {
        const quoteText = quoteMatch[1].trim();
        if (quoteText.length > 30) {
          reviews.push({
            rating: 5, // Assume featured quotes are positive
            text: `"${quoteText}"`,
            author: "Featured Review",
            date: "",
          });
        }
      }
    }

    console.log(`Extracted ${reviews.length} reviews`);

    const result: GoodreadsData = {
      rating,
      ratingsCount,
      reviewsCount,
      reviews,
      goodreadsUrl: bookUrl,
    };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching Goodreads data:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch Goodreads data";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
