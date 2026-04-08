import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    {
      name: 'fetch-books-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/fetch-books')) {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsedBody = body ? JSON.parse(body) : {};
                const { query, subject, page = 1, limit = 20 } = parsedBody;

                const baseUrl = "https://gutendex.com/books";
                const params = new URLSearchParams();
                if (query) params.set("search", query);
                if (subject) params.set("topic", subject);
                params.set("page", page.toString());

                const response = await fetch(`${baseUrl}?${params.toString()}`);
                const data: any = await response.json();
                
                const books = (data.results || []).slice(0, limit).map((book: any) => ({
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

                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ books, total: books.length }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
