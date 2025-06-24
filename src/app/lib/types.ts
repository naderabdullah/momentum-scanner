// src/app/lib/types.ts - Updated without plan system
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
  patternType?: 'bullish' | 'bearish' | 'continuation' | 'reversal';
  targetPrice?: number;
  stopLoss?: number;
}

export interface PriceAction {
  trend: 'bullish' | 'bearish' | 'neutral';
  momentum: 'accelerating' | 'decelerating' | 'stable';
  support?: number;
  resistance?: number;
  breakout?: boolean;
  consolidation?: boolean;
}

export interface OrderFlowData {
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  netFlow: number;
  largeBlockTrades: number;
  institutionalFlow: 'buying' | 'selling' | 'neutral';
  orderImbalance: number;
  darkPoolActivity: number;
}

export interface Alert {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  ticker: string;
  message: string;
  timestamp: number;
  alertType?: 'volume_surge' | 'price_breakout' | 'pattern_detected' | 'buy_signal' | 'news_catalyst' | 'system' | 'level2_signal';
  dismissed?: boolean;
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
  depth?: {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
  };
  marketMakers?: string[];
  lastTrade?: {
    price: number;
    size: number;
    time: number;
  };
}

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
  marketMaker?: string;
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
  minVolume: number;
  maxMarketCap?: number;
  sectors?: string[];
  exchanges?: string[];
}

export interface BuyScoreCriteria {
  relativeVolumeWeight: number; // Target: >5x
  priceChangeWeight: number;    // Target: >10%
  floatWeight: number;          // Target: <20M  
  priceRangeWeight: number;     // Target: $2-$20
  newsCatalystWeight: number;   // Has news catalyst
  patternWeight: number;        // Technical patterns
  volumeSurgeWeight: number;    // Volume surge detection
  level2Weight: number;         // Level 2 order flow
  momentumWeight: number;       // Price momentum
}

// Advanced volume analysis
export interface VolumeProfile {
  ticker: string;
  avgVolume30D: number;
  todayVolume: number;
  relativeVolume: number;
  volumeSpikes: number[];
  unusualActivity: boolean;
  institutionalFlow: number;
}

// Pattern recognition interface
export interface PatternRecognizer {
  detectBullFlag(candles: CandlestickData[]): DetectedPattern | null;
  detectBearFlag(candles: CandlestickData[]): DetectedPattern | null;
  detectBreakout(candles: CandlestickData[]): DetectedPattern | null;
  detectDoubleBottom(candles: CandlestickData[]): DetectedPattern | null;
  detectDoubleTop(candles: CandlestickData[]): DetectedPattern | null;
  detectTriangle(candles: CandlestickData[]): DetectedPattern | null;
  detectAllPatterns(ticker: string, candles: CandlestickData[]): DetectedPattern[];
}

// Candlestick data for pattern recognition
export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

// Technical indicator data
export interface TechnicalIndicators {
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    ema9: number;
    ema21: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
}

// News and catalyst data
export interface NewsCatalyst {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
  publishedAt: number;
  source: string;
  impact: 'high' | 'medium' | 'low';
  categories: string[];
}

// Market maker data
export interface MarketMakerData {
  name: string;
  bidSize: number;
  askSize: number;
  spread: number;
  lastUpdate: number;
  activity: 'active' | 'passive' | 'aggressive';
}

// Institutional flow data
export interface InstitutionalFlow {
  ticker: string;
  netFlow: number; // positive = buying, negative = selling
  largeOrders: number;
  blockTrades: number;
  darkPoolVolume: number;
  institutionalPercent: number;
  timestamp: number;
}

// Options flow data
export interface OptionsFlow {
  ticker: string;
  putCallRatio: number;
  unusualActivity: boolean;
  largestTrades: {
    type: 'call' | 'put';
    strike: number;
    expiry: string;
    volume: number;
    openInterest: number;
    premium: number;
  }[];
  impliedVolatility: number;
  skew: number;
}

// Sector performance data
export interface SectorPerformance {
  sector: string;
  performance: number;
  leaders: string[];
  laggards: string[];
  avgVolume: number;
  momentum: 'bullish' | 'bearish' | 'neutral';
}

// Real-time market data
export interface MarketData {
  timestamp: number;
  ticker: string;
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  close: number;
  vwap: number;
  trades: number;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'trade' | 'quote' | 'aggregate' | 'news' | 'status';
  data: any;
  timestamp: number;
}

// Scanner configuration
export interface ScannerConfig {
  scanInterval: number;
  maxStocks: number;
  minBuyScore: number;
  alertThresholds: {
    volumeSurge: number;
    priceBreakout: number;
    buyScore: number;
  };
  dataFeeds: {
    trades: boolean;
    quotes: boolean;
    aggregates: boolean;
    news: boolean;
    options: boolean;
  };
}

// Performance metrics
export interface PerformanceMetrics {
  totalStocksScanned: number;
  highBuyScoreStocks: number;
  volumeSurgeStocks: number;
  patternsDetected: number;
  alertsGenerated: number;
  apiCallsUsed: number;
  scanningSpeed: number; // stocks per second
  uptime: number; // milliseconds
  memoryUsage: number; // MB
}