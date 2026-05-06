import {
  useListFavorites,
  useAddFavorite,
  useRemoveFavorite,
  useListReviews,
  useAddReview,
  getListFavoritesQueryKey,
  getListReviewsQueryKey,
  type Favorite,
  type Review,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type { Favorite, Review };

export interface FavoriteBook {
  workId: string;
  title: string;
  author?: string;
  coverUrl?: string;
}

export function useFavorites() {
  const qc = useQueryClient();
  const { data: favorites = [], isLoading } = useListFavorites();
  const add = useAddFavorite({
    mutation: {
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: getListFavoritesQueryKey() }),
    },
  });
  const remove = useRemoveFavorite({
    mutation: {
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: getListFavoritesQueryKey() }),
    },
  });

  const isFavorite = (workId: string) =>
    favorites.some((f) => f.workId === workId);

  const toggleFavorite = (book: FavoriteBook) => {
    if (isFavorite(book.workId)) {
      remove.mutate({ workId: book.workId });
    } else {
      add.mutate({
        data: {
          workId: book.workId,
          title: book.title,
          author: book.author ?? null,
          coverUrl: book.coverUrl ?? null,
        },
      });
    }
  };

  return { favorites, isFavorite, toggleFavorite, isLoading };
}

export function useReviews(workId: string) {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useListReviews(workId, {
    query: { enabled: !!workId } as never,
  });
  const add = useAddReview({
    mutation: {
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: getListReviewsQueryKey(workId) }),
    },
  });

  const addReview = (review: { stars: number; name: string; text: string }) => {
    add.mutate({ workId, data: review });
  };

  return { reviews, addReview, isLoading, isAdding: add.isPending };
}
