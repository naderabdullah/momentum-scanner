// lib/types.ts
export interface Stock {
  ticker: string;
  price: number;
  todaysChange: number;
  todaysChangePerc: number;
  day: { v: number };
  relVol: number;
  float: number;
  buy_score: number;
  hasCatalyst: boolean;
  patterns: { [key: string]: boolean };
}

export interface Alert {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  ticker: string;
  message: string;
  timestamp: number;
}

export interface Level2Data {
    ticker: string;
    bid_price: number;
    bid_size: number;
    ask_price: number;
    ask_size: number;
}

export type Pattern = {
    [ticker: string]: string[];
}

export interface ScanCriteria {
  maxFloat: number;
  minChange: number;
  minPrice: number;
  maxPrice: number;
  minRelVol: number;
}