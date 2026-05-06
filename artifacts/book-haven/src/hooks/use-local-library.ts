import { useState, useEffect } from "react";

export interface Review {
  id: string;
  stars: number;
  name: string;
  text: string;
  createdAt: number;
}

export interface FavoriteBook {
  workId: string;
  title: string;
  author?: string;
  coverUrl?: string;
}

export function useReviews(workId: string) {
  const key = `book-haven:reviews:${workId}`;
  
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setReviews(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, [key]);

  const addReview = (review: Omit<Review, "id" | "createdAt">) => {
    const newReview: Review = {
      ...review,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    const updated = [newReview, ...reviews];
    setReviews(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  return { reviews, addReview };
}

export function useFavorites() {
  const key = `book-haven:favorites`;
  
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, [key]);

  const toggleFavorite = (book: FavoriteBook) => {
    let updated: FavoriteBook[];
    const isFav = favorites.some(f => f.workId === book.workId);
    
    if (isFav) {
      updated = favorites.filter(f => f.workId !== book.workId);
    } else {
      updated = [...favorites, book];
    }
    
    setFavorites(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const isFavorite = (workId: string) => favorites.some(f => f.workId === workId);

  return { favorites, toggleFavorite, isFavorite };
}
