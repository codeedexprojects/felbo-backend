export function formatRating(rating: number): number {
  if (!rating || isNaN(rating)) return 0;
  return Math.round(rating * 10) / 10;
}
