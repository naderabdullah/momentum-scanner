// src/app/lib/types.ts
export interface Stock {
  ticker: string;
  price: number;
  todaysChange: number;
  todaysChangePerc: number;
  day: {
    v: number; // volume
    o?: number; // open
    h?: number; // high  
    l?: number; // low
    c?: number; // close
    vw?: number; // volume weighted average price
  };
  relVol: number;
  float: number;
  buy_score: number;
  hasCatalyst: boolean;
  marketCap?: number;
  avgVolume30D?: number;
  volatility?: number;
  patterns?: DetectedPattern[];
  volumeSurge?: boolean;
  priceAction?: PriceAction;
  orderFlow?: OrderFlowData;
}

export interface DetectedPattern {
  name: string;
  confidence: number;
  timeframe: string;
  detected_at: number;
  description?: string;
}

export interface PriceAction {
  trend: 'bullish' | 'bearish' | 'neutral';
  momentum: 'accelerating' | 'decelerating' | 'stable';
  support?: number;
  resistance?: number;
  breakout?: boolean;
}

export interface OrderFlowData {
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  netFlow: number;
  largeBlockTrades: number;
  institutionalFlow: 'buying' | 'selling' | 'neutral';
}

export interface Alert {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  ticker: string;
  message: string;
  timestamp: number;
  alertType?: 'volume_surge' | 'price_breakout' | 'pattern_detected' | 'buy_signal' | 'news_catalyst' | 'system';
}

export interface Level2Data {
  ticker: string;
  bid_price: number;
  bid_size: number;
  ask_price: number;
  ask_size: number;
  spread: number;
  spreadPercent: number;
  timestamp: number;
  orderFlow?: 'buying' | 'selling' | 'neutral';
  imbalance?: number;
}

// Fix the Pattern type to match InfoPanels expectation
export interface PatternData {
  [ticker: string]: string[]; // Array of pattern names for display
}

export interface ScanCriteria {
  maxFloat: number;
  minChange: number;
  minPrice: number;
  maxPrice: number;
  minRelVol: number;
  requireNews: boolean;
}

export interface BuyScoreCriteria {
  relativeVolumeWeight: number; // Target: >5x
  priceChangeWeight: number;    // Target: >10%
  floatWeight: number;          // Target: <20M  
  priceRangeWeight: number;     // Target: $2-$20
  newsCatalystWeight: number;   // Has news catalyst
  patternWeight: number;        // Technical patterns
  volumeSurgeWeight: number;    // Volume surge detection
}

// Advanced plan features
export interface UserPlan {
  level: 'basic' | 'advanced' | 'pro';
  features: {
    level2Data: boolean;
    patternRecognition: boolean;
    volumeSurgeDetection: boolean;
    orderFlowAnalysis: boolean;
    realTimeNews: boolean;
    advancedScreening: boolean;
    customAlerts: boolean;
  };
}

// Polygon WebSocket message types
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

// Pattern recognition types
export interface CandlestickData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface PatternRecognizer {
  detectBullFlag(candles: CandlestickData[]): DetectedPattern | null;
  detectBearFlag(candles: CandlestickData[]): DetectedPattern | null;
  detectBreakout(candles: CandlestickData[]): DetectedPattern | null;
  detectDoubleBottom(candles: CandlestickData[]): DetectedPattern | null;
  detectDoubleTop(candles: CandlestickData[]): DetectedPattern | null;
  detectTriangle(candles: CandlestickData[]): DetectedPattern | null;
}

// Volume analysis types
export interface VolumeProfile {
  ticker: string;
  avgVolume30D: number;
  todayVolume: number;
  relativeVolume: number;
  volumeSpikes: number[];
  unusualActivity: boolean;
  institutionalFlow: number;
}