// src/app/lib/types.ts
export interface Stock {
  ticker: string;
  price: number;
  todaysChange: number;
  todaysChangePerc: number;
  day: {
    v: number; // volume
  };
  relVol: number;
  float: number;
  buy_score: number;
  hasCatalyst: boolean;
  patterns?: {
    [key: string]: boolean;
  };
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

export interface Pattern {
  [ticker: string]: {
    [patternName: string]: boolean;
  };
}

export interface ScanCriteria {
  maxFloat: number;
  minChange: number;
  minPrice: number;
  maxPrice: number;
  minRelVol: number;
}

// Polygon-specific types
export interface PolygonTrade {
  ev: 'T';
  sym: string;
  i: string;
  x: number;
  p: number;
  s: number;
  c?: number[];
  t: number;
  q?: number;
  z?: number;
}

export interface PolygonQuote {
  ev: 'Q';
  sym: string;
  bx: number;
  bp: number;
  bs: number;
  ax: number;
  ap: number;
  as: number;
  t: number;
  q?: number;
  z?: number;
}

export interface PolygonAggregate {
  ev: 'AM' | 'A';
  sym: string;
  v: number;
  av: number;
  op?: number;
  vw: number;
  o: number;
  c: number;
  h: number;
  l: number;
  s: number;
  e: number;
}

export interface PolygonStatus {
  ev: 'status';
  status: 'connected' | 'auth_success' | 'auth_failed' | 'success' | 'error';
  message: string;
}