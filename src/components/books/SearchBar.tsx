import { useState, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchFilters {
  source?: 'gutenberg' | 'standard_ebooks' | 'all';
  subject?: string;
  language?: string;
}

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  className?: string;
  placeholder?: string;
}

const SUBJECTS = [
  'Fiction',
  'Non-Fiction',
  'Poetry',
  'Drama',
  'Philosophy',
  'History',
  'Science',
  'Adventure',
  'Romance',
  'Mystery',
];

export function SearchBar({ onSearch, className, placeholder = 'Search for books, authors...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ source: 'all' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleSearch = useCallback(() => {
    onSearch(query, filters);
  }, [query, filters, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setQuery('');
    setFilters({ source: 'all' });
    onSearch('', { source: 'all' });
  };

  const activeFiltersCount = Object.values(filters).filter(
    (v) => v && v !== 'all'
  ).length;

  return (
    <div className={cn('flex flex-col sm:flex-row gap-2', className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10 h-12 text-base bg-card border-border/50 focus:border-primary"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-12 gap-2 relative">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-4">
              <h4 className="font-medium">Filter Books</h4>
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Source</label>
                <Select
                  value={filters.source}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, source: value as SearchFilters['source'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="gutenberg">Project Gutenberg</SelectItem>
                    <SelectItem value="standard_ebooks">Standard Ebooks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Subject</label>
                <Select
                  value={filters.subject || ''}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, subject: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Subjects</SelectItem>
                    {SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject.toLowerCase()}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setFiltersOpen(false);
                  handleSearch();
                }}
              >
                Apply Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch} className="h-12 px-6">
          Search
        </Button>
      </div>
    </div>
  );
}
