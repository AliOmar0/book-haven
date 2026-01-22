import { supabase } from '@/integrations/supabase/client';
import type { GoodreadsData } from '@/types/goodreads';

export const goodreadsApi = {
  async fetchBookData(title: string, author?: string): Promise<GoodreadsData | null> {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-goodreads', {
        body: { title, author },
      });

      if (error) {
        console.error('Error fetching Goodreads data:', error);
        return null;
      }

      if (!data?.success) {
        console.error('Goodreads fetch failed:', data?.error);
        return null;
      }

      return data.data as GoodreadsData;
    } catch (error) {
      console.error('Error calling Goodreads API:', error);
      return null;
    }
  },
};
