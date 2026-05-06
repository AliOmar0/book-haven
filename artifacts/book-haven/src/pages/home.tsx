import { useSubjectBooks } from "@/hooks/use-open-library";
import { BookCard, BookCardSkeleton } from "@/components/book-card";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "wouter";
import React, { Suspense } from "react";
import { cn } from "@/lib/utils";

const Hero3D = React.lazy(() => import("@/components/hero-3d"));

const SHELVES = [
  { id: "classics", title: "Timeless Classics", description: "The foundation of any good library." },
  { id: "mystery", title: "Mystery & Detective", description: "Atmospheric tales of suspense." },
  { id: "romance", title: "Romance", description: "Tales of love and longing." },
  { id: "fantasy", title: "Fantasy", description: "Worlds beyond our own." },
];

function Shelf({ subject, title, description, index }: { subject: string; title: string; description: string; index: number }) {
  const { data, isLoading, error } = useSubjectBooks(subject);

  if (error) return null;

  // Alternate backgrounds for warmth
  const bgClass = index % 2 === 0 ? "bg-background" : "bg-[#efe8d8] dark:bg-card";

  return (
    <section className={cn("py-16 relative border-t border-accent/20", bgClass)}>
      {/* Brass horizontal divider line instead of plain border */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
      
      <div className="px-6 md:px-12 max-w-7xl mx-auto relative z-10">
        <div className="flex items-end justify-between mb-12">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {/* Brass flourish */}
              <div className="flex items-center">
                <div className="w-8 h-[1px] bg-accent" />
                <div className="w-1.5 h-1.5 rounded-full bg-accent ml-1" />
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight">{title}</h2>
            </div>
            <p className="text-muted-foreground font-medium pl-14 text-lg">{description}</p>
          </div>
          <Link href={`/search?q=${subject}`} className="hidden md:flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors uppercase tracking-wider">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 gap-y-10 relative z-10">
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
          {/* Deep-brown gradient shadow strip suggesting a wooden shelf board */}
          <div className="absolute -bottom-4 left-0 w-full h-8 bg-gradient-to-b from-[#3a2618]/40 dark:from-black/60 to-transparent blur-sm rounded-full -z-0 pointer-events-none" />
          <div className="absolute -bottom-2 left-0 w-full h-2 bg-[#4a321f] dark:bg-[#1a120e] rounded-t-sm shadow-[0_4px_8px_rgba(0,0,0,0.5)] -z-0 pointer-events-none" />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <Layout>
      {/* Paper texture overlay for the whole home page */}
      <div className="fixed inset-0 pointer-events-none mix-blend-multiply opacity-[0.03] dark:opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] z-50" />
      
      <div className="relative min-h-[70vh] md:min-h-[80vh] flex items-center bg-gradient-to-br from-[#122216] via-[#1a2e20] to-[#2d1215] text-[#f4ecd8] overflow-hidden">
        {/* God rays via radial gradients */}
        <div className="absolute top-0 left-1/4 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#ffe5b4]/20 via-transparent to-transparent pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-[#ff9a55]/10 via-transparent to-transparent pointer-events-none mix-blend-screen" />
        
        {/* Subtle vignette */}
        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.7)] pointer-events-none" />
        
        {/* 3D Scene Container */}
        <div className="absolute inset-0 md:left-1/2 w-full md:w-1/2 h-full z-0 flex items-center justify-center opacity-80 md:opacity-100 mix-blend-screen md:mix-blend-normal">
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-transparent to-[#1a2e20]/50 blur-xl transition-all duration-1000" />
          }>
            <Hero3D />
          </Suspense>
        </div>

        <div className="relative px-6 md:px-12 py-24 md:py-32 max-w-7xl mx-auto w-full z-10 grid grid-cols-1 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="space-y-8 max-w-xl text-center md:text-left"
          >
            <div className="inline-flex items-center justify-center md:justify-start gap-3 text-[#dcd0b8]/80 mb-2">
              <div className="w-8 h-[1px] bg-accent hidden md:block" />
              <span className="uppercase tracking-widest text-xs font-semibold">The Reading Room</span>
            </div>
            
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] text-white drop-shadow-md">
              A quiet place <br />
              <span className="text-[#dcd0b8] italic font-normal">for classic stories.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-[#dcd0b8]/90 font-medium leading-relaxed drop-shadow">
              "A reader lives a thousand lives before he dies. The man who never reads lives only one."
            </p>
            
            <div className="pt-6">
              <Link
                href="/search"
                className="inline-flex items-center justify-center h-14 px-8 rounded-sm bg-[#c39f61] text-[#1a120e] font-medium transition-all hover:bg-[#d8b87a] hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(195,159,97,0.3)] hover:shadow-[0_0_30px_rgba(195,159,97,0.5)] uppercase tracking-wider text-sm"
              >
                Browse the Stacks
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="bg-background relative">
        {SHELVES.map((shelf, i) => (
          <Shelf key={shelf.id} subject={shelf.id} title={shelf.title} description={shelf.description} index={i} />
        ))}
      </div>
    </Layout>
  );
}
