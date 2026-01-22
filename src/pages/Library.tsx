import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Library as LibraryIcon, Play, Trash2, Clock, BookMarked, Check, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { libraryApi } from '@/lib/api/books';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { UserLibraryItem } from '@/types/book';

type StatusFilter = 'all' | 'reading' | 'want_to_read' | 'finished';

interface LibraryBookCardProps {
  item: UserLibraryItem;
  onStatusChange: (id: string, status: 'reading' | 'want_to_read' | 'finished') => void;
  onRemove: (id: string) => void;
}

function LibraryBookCard({ item, onStatusChange, onRemove }: LibraryBookCardProps) {
  const book = item.book;
  if (!book) return null;

  const statusLabels = {
    reading: 'Currently Reading',
    want_to_read: 'Want to Read',
    finished: 'Finished',
  };

  const statusColors = {
    reading: 'bg-primary text-primary-foreground',
    want_to_read: 'bg-secondary text-secondary-foreground',
    finished: 'bg-accent text-accent-foreground',
  };

  return (
    <Card className="group overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Cover */}
        <Link to={`/book/${book.id}`} className="flex-shrink-0">
          <div className="relative w-24 aspect-[2/3] rounded-md overflow-hidden bg-muted">
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <BookOpen className="h-8 w-8 text-primary/40" />
              </div>
            )}
          </div>
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/book/${book.id}`}>
                <h3 className="font-serif font-semibold text-foreground line-clamp-1 hover:text-primary transition-colors">
                  {book.title}
                </h3>
              </Link>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {book.author}
              </p>
            </div>
            <Badge className={statusColors[item.status]} variant="secondary">
              {statusLabels[item.status]}
            </Badge>
          </div>

          {/* Progress Bar (for reading status) */}
          {item.status === 'reading' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(Number(item.reading_progress) || 0)}%</span>
              </div>
              <Progress value={Number(item.reading_progress) || 0} className="h-2" />
            </div>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {item.started_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Started {new Date(item.started_at).toLocaleDateString()}
              </span>
            )}
            {item.finished_at && (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Finished {new Date(item.finished_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {book.epub_url && (
              <Button asChild size="sm" variant="default">
                <Link to={`/read/${book.id}`}>
                  <Play className="h-3 w-3 mr-1" />
                  {item.status === 'reading' ? 'Continue' : 'Read'}
                </Link>
              </Button>
            )}

            {item.status !== 'reading' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(item.id, 'reading')}
              >
                <BookMarked className="h-3 w-3 mr-1" />
                Start Reading
              </Button>
            )}

            {item.status === 'reading' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(item.id, 'finished')}
              >
                <Check className="h-3 w-3 mr-1" />
                Mark Finished
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove from Library?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove "{book.title}" from your library. Your reading progress will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRemove(item.id)}>
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Library() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [library, setLibrary] = useState<UserLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Fetch library
  useEffect(() => {
    async function loadLibrary() {
      if (!user) return;

      try {
        setLoading(true);
        const data = await libraryApi.getLibrary(user.id);
        setLibrary(data);
      } catch (error) {
        console.error('Error loading library:', error);
        toast({
          title: 'Error loading library',
          description: 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    loadLibrary();
  }, [user, toast]);

  // Handle status change
  const handleStatusChange = useCallback(async (id: string, status: 'reading' | 'want_to_read' | 'finished') => {
    try {
      await libraryApi.updateStatus(id, status);
      setLibrary((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
              ...item,
              status,
              started_at: status === 'reading' ? new Date().toISOString() : item.started_at,
              finished_at: status === 'finished' ? new Date().toISOString() : item.finished_at,
            }
            : item
        )
      );
      toast({
        title: 'Status updated',
        description: `Book marked as "${status.replace('_', ' ')}"`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Failed to update status',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Handle remove
  const handleRemove = useCallback(async (id: string) => {
    try {
      await libraryApi.removeFromLibrary(id);
      setLibrary((prev) => prev.filter((item) => item.id !== id));
      toast({
        title: 'Removed from library',
        description: 'The book has been removed from your library.',
      });
    } catch (error) {
      console.error('Error removing from library:', error);
      toast({
        title: 'Failed to remove',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Filter books by status
  const filteredBooks = library.filter((item) => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  // Count by status
  const counts = {
    all: library.length,
    reading: library.filter((i) => i.status === 'reading').length,
    want_to_read: library.filter((i) => i.status === 'want_to_read').length,
    finished: library.filter((i) => i.status === 'finished').length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <LibraryIcon className="h-8 w-8 text-primary" />
          <h1 className="font-serif text-3xl font-bold">My Library</h1>
        </div>

        {/* Stats Overview */}
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'all' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            onClick={() => setActiveTab('all')}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <LibraryIcon className="h-5 w-5 mb-2 text-primary" />
              <p className="text-3xl font-bold text-foreground">{counts.all}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Books</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'reading' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            onClick={() => setActiveTab('reading')}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <BookOpen className="h-5 w-5 mb-2 text-blue-500" />
              <p className="text-3xl font-bold text-foreground">{counts.reading}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reading</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'want_to_read' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            onClick={() => setActiveTab('want_to_read')}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <BookMarked className="h-5 w-5 mb-2 text-amber-500" />
              <p className="text-3xl font-bold text-foreground">{counts.want_to_read}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Want to Read</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${activeTab === 'finished' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
            onClick={() => setActiveTab('finished')}
          >
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Check className="h-5 w-5 mb-2 text-green-500" />
              <p className="text-3xl font-bold text-foreground">{counts.finished}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Finished</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusFilter)}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="reading">Reading ({counts.reading})</TabsTrigger>
            <TabsTrigger value="want_to_read">Want to Read ({counts.want_to_read})</TabsTrigger>
            <TabsTrigger value="finished">Finished ({counts.finished})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredBooks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredBooks.map((item) => (
                  <LibraryBookCard
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-serif text-xl font-semibold mb-2">No books yet</h3>
                <p className="text-muted-foreground mb-6">
                  {activeTab === 'all'
                    ? 'Start building your library by adding books you want to read.'
                    : `You don't have any books in this category yet.`}
                </p>
                <Button asChild>
                  <Link to="/">Browse Books</Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
