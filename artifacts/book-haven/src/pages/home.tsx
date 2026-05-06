import { useSubjectBooks } from "@/hooks/use-open-library";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "wouter";

const SHELVES = [
  { id: "classics", title: "Timeless Classics", description: "The foundation of any good library." },
  { id: "mystery", title: "Mystery & Detective", description: "Atmospheric tales of suspense." },
  { id: "romance", title: "Romance", description: "Tales of love and longing." },
  { id: "fantasy", title: "Fantasy", description: "Worlds beyond our own." },
];

function Shelf({ subject, title, description }: { subject: string; title: string; description: string }) {
  const { data, isLoading, error } = useSubjectBooks(subject);

  if (error) return null;

  return (
    <section className="py-12 border-b border-border/40 last:border-0">
      <div className="px-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">{title}</h2>
            <p className="text-muted-foreground font-medium">{description}</p>
          </div>
          <Link href={`/search?q=${subject}`} className="hidden md:flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <BookCardSkeleton key={i} />)
            : data?.works.slice(0, 5).map((book, i) => (
                <BookCard
                  key={book.key}
                  workId={book.key}
                  title={book.title}
                  author={book.authors?.[0]?.name}
                  coverId={book.cover_id}
                  delay={i * 0.1}
                />
              ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout>
      <div className="relative bg-primary text-primary-foreground overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent mix-blend-overlay" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay" />
        
        <div className="relative px-6 md:px-12 py-24 md:py-32 max-w-7xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-6 max-w-3xl"
          >
            <BookOpen className="w-12 h-12 mx-auto text-accent mb-6" />
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
              A quiet place <br className="hidden md:block" />
              <span className="text-accent italic font-normal">for classic stories.</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-xl mx-auto font-medium">
              "A reader lives a thousand lives before he dies. The man who never reads lives only one."
            </p>
            <div className="pt-8">
              <Link
                href="/search"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-accent text-accent-foreground font-medium transition-transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Browse the Stacks
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="bg-background">
        {SHELVES.map((shelf) => (
          <Shelf key={shelf.id} subject={shelf.id} title={shelf.title} description={shelf.description} />
        ))}
      </div>
    </Layout>
  );
}
