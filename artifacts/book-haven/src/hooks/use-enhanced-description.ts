import { useGoogleBookInfo } from "./use-google-books";
import { cleanDescription, isMeaningfulDescription } from "@/lib/clean-description";

export interface EnhancedDescription {
  text: string;
  source: "google" | "openlibrary" | "none";
  publisher?: string;
  publishedDate?: string;
  loading: boolean;
}

/**
 * Picks the best available synopsis from Google Books (richer, publisher
 * blurbs) and falls back to the cleaned Open Library description.
 */
export function useEnhancedDescription(
  title: string | undefined,
  author: string | undefined,
  openLibraryRaw: string | { value: string } | null | undefined,
): EnhancedDescription {
  const { data: gInfo, isLoading } = useGoogleBookInfo(title, author);

  const googleText = (gInfo?.description || "").trim();
  const olText = cleanDescription(openLibraryRaw);

  if (googleText && isMeaningfulDescription(googleText)) {
    return {
      text: googleText,
      source: "google",
      publisher: gInfo?.publisher,
      publishedDate: gInfo?.publishedDate,
      loading: false,
    };
  }
  if (olText && isMeaningfulDescription(olText)) {
    return { text: olText, source: "openlibrary", loading: false };
  }
  if (isLoading) return { text: "", source: "none", loading: true };
  // Last-ditch: short Google text if any
  if (googleText) return { text: googleText, source: "google", loading: false };
  return { text: "", source: "none", loading: false };
}
