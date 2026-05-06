import { Link } from "wouter";
import { CoverImage } from "./cover-image";
import { getCoverUrl } from "@/hooks/use-open-library";
import { motion } from "framer-motion";

interface BookCardProps {
  workId: string;
  title: string;
  author?: string;
  coverId?: number;
  delay?: number;
}

export function BookCard({ workId, title, author, coverId, delay = 0 }: BookCardProps) {
  const coverUrl = getCoverUrl(coverId, "M");
  // Clean workId if it has /works/ prefix
  const id = workId.replace("/works/", "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="group"
    >
      <Link href={`/book/${id}`} className="block space-y-3">
        <div className="relative overflow-hidden rounded-md shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
          <CoverImage src={coverUrl} alt={title} className="w-full" />
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          {author && (
            <p className="text-xs text-muted-foreground line-clamp-1 uppercase tracking-wider font-medium">
              {author}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-[2/3] w-full bg-muted animate-pulse rounded-md" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
