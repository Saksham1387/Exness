export interface Candle {
  openTime: number;
  open:     number;
  high:     number;
  low:      number;
  close:    number;
  decimals: number;
}

export interface PriceUpdate {
  symbol:    string;
  buyPrice:  number;
  sellPrice: number;
  decimals:  number;
}
