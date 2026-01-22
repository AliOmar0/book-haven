import { Link } from 'react-router-dom';
import { 
  Compass, 
  Heart, 
  Search, 
  Rocket, 
  BookOpen, 
  Clock, 
  Feather,
  Sparkles 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const genres = [
  { 
    id: 'fiction', 
    label: 'Fiction', 
    icon: BookOpen, 
    color: 'from-primary/20 to-primary/5',
    description: 'Classic novels & stories'
  },
  { 
    id: 'adventure', 
    label: 'Adventure', 
    icon: Compass, 
    color: 'from-amber-500/20 to-amber-500/5',
    description: 'Thrilling journeys'
  },
  { 
    id: 'romance', 
    label: 'Romance', 
    icon: Heart, 
    color: 'from-rose-500/20 to-rose-500/5',
    description: 'Love stories'
  },
  { 
    id: 'mystery', 
    label: 'Mystery', 
    icon: Search, 
    color: 'from-violet-500/20 to-violet-500/5',
    description: 'Detective tales'
  },
  { 
    id: 'science-fiction', 
    label: 'Sci-Fi', 
    icon: Rocket, 
    color: 'from-cyan-500/20 to-cyan-500/5',
    description: 'Future worlds'
  },
  { 
    id: 'philosophy', 
    label: 'Philosophy', 
    icon: Sparkles, 
    color: 'from-emerald-500/20 to-emerald-500/5',
    description: 'Great thinkers'
  },
  { 
    id: 'history', 
    label: 'History', 
    icon: Clock, 
    color: 'from-orange-500/20 to-orange-500/5',
    description: 'Past events'
  },
  { 
    id: 'poetry', 
    label: 'Poetry', 
    icon: Feather, 
    color: 'from-pink-500/20 to-pink-500/5',
    description: 'Verses & rhymes'
  },
];

interface GenreGridProps {
  onGenreClick?: (subject: string) => void;
}

export function GenreGrid({ onGenreClick }: GenreGridProps) {
  return (
    <section className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-foreground">
          Browse by Genre
        </h2>
        <p className="text-muted-foreground">
          Discover classics across every category
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {genres.map((genre) => {
          const Icon = genre.icon;
          return (
            <button
              key={genre.id}
              onClick={() => onGenreClick?.(genre.label)}
              className={cn(
                "group relative overflow-hidden rounded-xl p-4 md:p-6",
                "bg-gradient-to-br border border-border/50",
                "hover:border-primary/30 hover:shadow-lg",
                "transition-all duration-300 hover:-translate-y-1",
                genre.color
              )}
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-background/80 group-hover:bg-background transition-colors">
                  <Icon className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{genre.label}</h3>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {genre.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
