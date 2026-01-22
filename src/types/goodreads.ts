export interface GoodreadsReview {
  rating: number;
  text: string;
  author: string;
  date: string;
}

export interface GoodreadsData {
  rating: number | null;
  ratingsCount: number | null;
  reviewsCount: number | null;
  reviews: GoodreadsReview[];
  goodreadsUrl: string | null;
}
