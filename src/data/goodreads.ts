export const goodreadsData: Record<string, { rating: number; count: number; reviews: number }> = {
    "Pride and Prejudice": { rating: 4.28, count: 4709712, reviews: 146000 },
    "Moby Dick": { rating: 3.56, count: 607122, reviews: 26746 },
    "Frankenstein": { rating: 3.82, count: 1939361, reviews: 92400 },
    "Romeo and Juliet": { rating: 3.76, count: 1822761, reviews: 38100 },
    "The Great Gatsby": { rating: 3.93, count: 5027515, reviews: 108000 },
    // Fallbacks for likely other titles if they appear
    "The Adventures of Sherlock Holmes": { rating: 4.29, count: 280000, reviews: 12000 },
    "Alice's Adventures in Wonderland": { rating: 4.06, count: 650000, reviews: 18000 },
    "Dracula": { rating: 4.01, count: 1200000, reviews: 40000 }
};

export const getGoodreadsRating = (title: string) => {
    // Try exact match
    if (goodreadsData[title]) return goodreadsData[title];

    // Try partial match
    const key = Object.keys(goodreadsData).find(k => title.includes(k) || k.includes(title));
    if (key) return goodreadsData[key];

    return null;
};
