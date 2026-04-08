import React, { useState, useCallback } from 'react';
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

  const activeFiltersCount = [
    filters.source && filters.source !== 'all' ? 1 : 0,
    filters.subject ? 1 : 0,
    filters.language ? 1 : 0
  ].reduce((a, b) => a + b, 0);

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
            <Button variant="outline" className="h-12 gap-2 shrink-0">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <div className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {activeFiltersCount}
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end" sideOffset={8}>
            <div className="space-y-4">
              <h4 className="font-serif font-base text-lg font-semibold px-1">Filter Books</h4>
              
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground px-1">Source</label>
                <Select
                  value={filters.source || 'all'}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, source: value as SearchFilters['source'] }))
                  }
                >
                  <SelectTrigger className="h-11">
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
                <label className="text-xs font-medium text-muted-foreground px-1">Subject</label>
                <Select
                  value={filters.subject || 'all-subjects'}
                  onValueChange={(value) =>
                    setFilters((f) => ({ ...f, subject: value === 'all-subjects' ? undefined : value }))
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-subjects">All Subjects</SelectItem>
                    {SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject.toLowerCase()}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button
                  variant="default"
                  className="w-full h-11"
                  onClick={(e) => {
                    e.preventDefault();
                    setFiltersOpen(false);
                    handleSearch();
                  }}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch} className="h-12 px-6 font-medium">
          Search
        </Button>
      </div>
    </div>
  );
}

