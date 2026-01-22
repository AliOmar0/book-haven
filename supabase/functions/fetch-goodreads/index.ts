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

    // Search Goodreads for the book
    const searchQuery = encodeURIComponent(`${title} ${author || ""}`);
    const goodreadsSearchUrl = `https://www.goodreads.com/search?q=${searchQuery}`;

    console.log("Searching Goodreads for:", title, "by", author);

    // First, search for the book
    const searchResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: goodreadsSearchUrl,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!searchResponse.ok) {
      console.error("Firecrawl search API error:", searchResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to search Goodreads" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchData = await searchResponse.json();
    const searchHtml = searchData.data?.html || searchData.html || "";

    // Extract the first book URL from search results
    const bookUrlMatch = searchHtml.match(/href="(\/book\/show\/[^"]+)"/);
    if (!bookUrlMatch) {
      console.log("No book found in Goodreads search");
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

    const bookPath = bookUrlMatch[1];
    const bookUrl = `https://www.goodreads.com${bookPath}`;
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
    ];

    for (const pattern of ratingPatterns) {
      const match = bookHtml.match(pattern);
      if (match) {
        rating = parseFloat(match[1]);
        console.log("Found rating:", rating);
        break;
      }
    }

    // Extract ratings count
    const ratingsCountPatterns = [
      /([\d,]+)\s*ratings/i,
      /(\d{1,3}(?:,\d{3})*)\s*rating/i,
      /"ratingCount"\s*:\s*"?(\d+)"?/i,
    ];

    for (const pattern of ratingsCountPatterns) {
      const match = bookHtml.match(pattern);
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
      const match = bookHtml.match(pattern);
      if (match) {
        reviewsCount = parseInt(match[1].replace(/,/g, ""), 10);
        console.log("Found reviews count:", reviewsCount);
        break;
      }
    }

    // Extract reviews - look for review content
    const reviews: GoodreadsReview[] = [];

    // Try to find review sections in HTML
    // Goodreads review structure varies, but typically includes reviewer name, rating, and text
    const reviewBlockRegex = /<section[^>]*class="[^"]*ReviewCard[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;
    let reviewMatch;
    let reviewCount = 0;

    while ((reviewMatch = reviewBlockRegex.exec(bookHtml)) !== null && reviewCount < 10) {
      const reviewBlock = reviewMatch[1];
      
      // Extract reviewer name
      const nameMatch = reviewBlock.match(/class="[^"]*ReviewerProfile__name[^"]*"[^>]*>([^<]+)</i) ||
                        reviewBlock.match(/aria-label="[^"]*by\s+([^"]+)"/i) ||
                        reviewBlock.match(/<a[^>]*href="\/user\/show\/[^"]*"[^>]*>([^<]+)</i);
      
      // Extract review text
      const textMatch = reviewBlock.match(/class="[^"]*ReviewText[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+(?:<br[^>]*>[^<]*)*)/i) ||
                        reviewBlock.match(/class="[^"]*TruncatedContent[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/i);
      
      // Extract review rating
      const reviewRatingMatch = reviewBlock.match(/aria-label="Rating (\d) out of 5"/i) ||
                                 reviewBlock.match(/class="[^"]*RatingStar[^"]*"[^>]*aria-label="(\d)/i);
      
      // Extract date
      const dateMatch = reviewBlock.match(/(\w+\s+\d{1,2},?\s+\d{4})/i) ||
                        reviewBlock.match(/<time[^>]*datetime="([^"]+)"/i);

      if (textMatch) {
        let reviewText = textMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();
        
        // Clean up text
        reviewText = reviewText.replace(/\s+/g, " ").substring(0, 1000);

        if (reviewText.length > 20) {
          reviews.push({
            rating: reviewRatingMatch ? parseInt(reviewRatingMatch[1], 10) : 0,
            text: reviewText,
            author: nameMatch ? nameMatch[1].trim() : "Anonymous",
            date: dateMatch ? dateMatch[1] : "",
          });
          reviewCount++;
        }
      }
    }

    // If we couldn't find structured reviews, try extracting from markdown
    if (reviews.length === 0 && bookMarkdown) {
      // Look for review-like content in markdown
      const markdownReviewPattern = /(?:★{1,5}|⭐{1,5}|\d\/5)[^\n]*\n([^\n]+(?:\n(?![★⭐\d])[^\n]+)*)/g;
      let mdMatch;
      while ((mdMatch = markdownReviewPattern.exec(bookMarkdown)) !== null && reviews.length < 5) {
        const text = mdMatch[1].trim();
        if (text.length > 30) {
          reviews.push({
            rating: 0,
            text: text.substring(0, 500),
            author: "Goodreads User",
            date: "",
          });
        }
      }
    }

    console.log(`Found ${reviews.length} reviews`);

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
