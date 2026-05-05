const PRICE_SCALE = 10_000;

export function priceToInt(priceStr: string): number {
  return Math.round(parseFloat(priceStr) * PRICE_SCALE);
}
