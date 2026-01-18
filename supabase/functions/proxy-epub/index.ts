import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const epubUrl = url.searchParams.get("url");

    if (!epubUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' query parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Proxying EPUB from:", epubUrl);

    // Fetch the EPUB file
    const response = await fetch(epubUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookshelfReader/1.0)",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch EPUB:", response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch EPUB: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the EPUB content as ArrayBuffer
    const epubData = await response.arrayBuffer();

    console.log("Successfully fetched EPUB, size:", epubData.byteLength);

    // Return the EPUB with proper headers
    return new Response(epubData, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/epub+zip",
        "Content-Length": epubData.byteLength.toString(),
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error: any) {
    console.error("Error proxying EPUB:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
