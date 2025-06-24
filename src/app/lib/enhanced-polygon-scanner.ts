// src/app/lib/enhanced-polygon-scanner.ts
import { websocketClient } from "@polygon.io/client-js";
import { Stock, Alert, Level2Data, PatternData, BuyScoreCriteria, CandlestickData, VolumeProfile, DetectedPattern } from './types';
import { AdvancedPatternRecognizer } from './pattern-recognition';

interface MarketMetrics {
  ticker: string;
  price: number;
  volume: number;
  volumeRatio: number;
  priceChangePercent: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  vwap: number;
  timestamp: number;
  trades: number;
  candlestickData: CandlestickData[];
}

interface ScanningCriteria {
  minVolume: number;
  minRelativeVolume: number;
  minPriceChangePercent: number;
  minPrice: number;
  maxPrice: number;
  maxFloat: number;
  requireNews: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

export class EnhancedPolygonScanner {
  private stocksWS: any;
  private restClient: any;
  private _isConnected: boolean = false;
  private marketMetrics: Map<string, MarketMetrics> = new Map();
  private watchlist: Set<string> = new Set();
  private scanningCriteria: ScanningCriteria;
  private buyScoreCriteria: BuyScoreCriteria;
  private patternRecognizer: AdvancedPatternRecognizer;
  private volumeProfiles: Map<string, VolumeProfile> = new Map();
  private level2Cache: Map<string, Level2Data> = new Map();
  private newsCache: Map<string, CachedData<any[]>> = new Map();
  private detailsCache: Map<string, CachedData<any>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Cache settings
  private cacheTimeout: number = 300000; // 5 minutes
  private lastScanTime: number = 0;
  private scanInterval: number = 15000; // 15 seconds for more frequent updates
  
  // Callbacks
  public onStockUpdate?: (stock: Partial<Stock>) => void;
  public onLevel2Update?: (data: Level2Data) => void;
  public onAlert?: (alert: Alert) => void;
  public onConnectionChange?: (connected: boolean) => void;
  public onError?: (error: string) => void;
  public onMarketScan?: (stocks: Stock[]) => void;
  public onPatternDetected?: (ticker: string, pattern: DetectedPattern) => void;
  public onVolumeSurge?: (ticker: string, surge: VolumeProfile) => void;

  constructor(apiKey: string, criteria?: Partial<ScanningCriteria>) {
    // Validate API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Polygon API key is required');
    }

    // Initialize Polygon clients
    try {
      const polygonClient = websocketClient(apiKey);
      this.stocksWS = polygonClient.stocks();
      
      // Import REST client for scanning
      import("@polygon.io/client-js").then(({ restClient }) => {
        this.restClient = restClient(apiKey);
      }).catch(error => {
        console.error('Failed to initialize REST client:', error);
      });
    } catch (error) {
      console.error('Failed to initialize Polygon WebSocket client:', error);
      throw error;
    }

    // Enhanced buy score criteria based on user requirements
    this.buyScoreCriteria = {
      relativeVolumeWeight: 30,  // 30% weight - target >5x
      priceChangeWeight: 25,     // 25% weight - target >10%
      floatWeight: 20,           // 20% weight - target <20M
      priceRangeWeight: 10,      // 10% weight - target $2-$20
      newsCatalystWeight: 10,    // 10% weight - has news
      patternWeight: 3,          // 3% weight - technical patterns
      volumeSurgeWeight: 2,      // 2% weight - volume surge
      level2Weight: 0,           // 0% weight - not implemented yet
      momentumWeight: 0          // 0% weight - not implemented yet
    };

    // Default scanning criteria
    this.scanningCriteria = {
      minVolume: 500000,         // 500K minimum volume
      minRelativeVolume: 5,      // 5x relative volume
      minPriceChangePercent: 10, // 10% minimum change
      minPrice: 2,               // $2 minimum
      maxPrice: 20,              // $20 maximum  
      maxFloat: 20000000,        // 20M max float (user specified)
      requireNews: false,        // Don't require news by default
      ...criteria
    };

    this.patternRecognizer = AdvancedPatternRecognizer.getInstance();
    
    // Delay WebSocket setup to avoid initialization issues
    setTimeout(() => {
      this.setupWebSocket();
    }, 1000);
  }

  private setupWebSocket() {
    try {
      console.log('🔌 Setting up Enhanced Polygon WebSocket connection...');
      
      this.stocksWS.onopen = () => {
        console.log("✅ Enhanced Polygon WebSocket connected successfully");
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
        this.subscribeToMarketData();
        this.startRealTimeScanning();
      };

      this.stocksWS.onmessage = ({ data }: { data: string }) => {
        try {
          const messages = JSON.parse(data);
          if (Array.isArray(messages)) {
            messages.forEach(msg => this.handleMessage(msg));
          } else {
            this.handleMessage(messages);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          this.onError?.('WebSocket message parsing error');
        }
      };

      this.stocksWS.onclose = (event: CloseEvent) => {
        console.log("❌ Polygon WebSocket disconnected:", event.code, event.reason);
        this._isConnected = false;
        this.onConnectionChange?.(false);
        
        // Clear any existing reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        
        // Only attempt reconnection if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(5000 * Math.pow(2, this.reconnectAttempts), 30000);
          console.log(`🔄 Attempting to reconnect in ${delay/1000}s... (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.setupWebSocket();
          }, delay);
        } else {
          console.error('❌ Max reconnection attempts reached. Please refresh the page.');
          this.onError?.('Max reconnection attempts reached');
        }
      };

      this.stocksWS.onerror = (error: any) => {
        console.error('❌ Polygon WebSocket error:', error);
        this.onError?.('WebSocket connection error');
      };
    } catch (error) {
      console.error('❌ Failed to setup WebSocket:', error);
      this.onError?.('Failed to setup WebSocket connection');
    }
  }

  private subscribeToMarketData() {
    if (!this.stocksWS || this.stocksWS.readyState !== WebSocket.OPEN) {
      console.error('❌ Cannot subscribe: WebSocket not open');
      return;
    }

    try {
      console.log('📡 Subscribing to ALL advanced market data streams...');
      
      // Subscribe to ALL streams since we removed plan restrictions
      const subscriptions = [
        'T.*',   // All trades
        'AM.*',  // All minute aggregates
        'Q.*',   // All quotes (Level 2)
        'A.*'    // All second aggregates for pattern detection
      ];

      const subscribeMessage = {
        action: 'subscribe',
        params: subscriptions.join(',')
      };

      console.log('📤 Sending advanced subscription message:', subscribeMessage);
      this.stocksWS.send(JSON.stringify(subscribeMessage));
      
      // Send authentication message
      const authMessage = {
        action: 'auth',
        params: process.env.NEXT_PUBLIC_POLYGON_API_KEY
      };
      
      console.log('🔐 Sending authentication message...');
      this.stocksWS.send(JSON.stringify(authMessage));
      
    } catch (error) {
      console.error('❌ Failed to subscribe to market data:', error);
      this.onError?.('Failed to subscribe to market data');
    }
  }

  private handleMessage(message: any) {
    if (!message || !message.ev) return;

    switch (message.ev) {
      case 'status':
        this.handleStatusMessage(message);
        break;
      case 'T': // Trade
        this.handleTradeMessage(message);
        break;
      case 'AM': // Minute aggregate
        this.handleAggregateMessage(message);
        break;
      case 'Q': // Quote (Level 2)
        this.handleQuoteMessage(message);
        break;
      case 'A': // Second aggregate
        this.handleSecondAggregateMessage(message);
        break;
    }
  }

  private handleStatusMessage(message: any) {
    console.log('📊 WebSocket Status:', message);
    if (message.status === 'auth_success') {
      console.log('✅ Authentication successful');
      this.onAlert?.({
        id: Date.now(),
        severity: 'info',
        ticker: 'SYSTEM',
        message: '🔐 Authentication successful - all advanced features active',
        timestamp: Date.now()
      });
    }
  }

  private handleTradeMessage(message: any) {
    const ticker = message.sym;
    if (!ticker) return;

    const existing = this.marketMetrics.get(ticker);
    const trade = {
      ticker,
      price: message.p,
      volume: message.s,
      timestamp: message.t,
      volumeRatio: existing ? (message.s / (existing.volume || 1)) : 1,
      priceChangePercent: existing ? ((message.p - existing.price) / existing.price) * 100 : 0,
      dayOpen: existing?.dayOpen || message.p,
      dayHigh: Math.max(existing?.dayHigh || 0, message.p),
      dayLow: Math.min(existing?.dayLow || Infinity, message.p),
      vwap: existing?.vwap || message.p,
      trades: (existing?.trades || 0) + 1,
      candlestickData: existing?.candlestickData || []
    };

    this.marketMetrics.set(ticker, trade);
    this.updateStockData(ticker, trade);
    
    // Advanced volume surge detection
    this.checkVolumeSurge(ticker, trade);
  }

  private handleAggregateMessage(message: any) {
    const ticker = message.sym;
    if (!ticker) return;

    const aggregate = {
      ticker,
      price: message.c,
      volume: message.v,
      volumeRatio: message.v / (message.av || 1),
      priceChangePercent: ((message.c - message.o) / message.o) * 100,
      dayOpen: message.o,
      dayHigh: message.h,
      dayLow: message.l,
      vwap: message.vw,
      timestamp: message.t,
      trades: message.n || 0,
      candlestickData: []
    };

    this.marketMetrics.set(ticker, aggregate);
    this.updateStockData(ticker, aggregate);
    
    // Advanced pattern recognition
    this.runPatternRecognition(ticker, aggregate);
  }

  private handleQuoteMessage(message: any) {
    const ticker = message.sym;
    if (!ticker) return;

    const level2Data: Level2Data = {
      ticker,
      bid_price: message.bp,
      bid_size: message.bs,
      ask_price: message.ap,
      ask_size: message.as,
      spread: message.ap - message.bp,
      spreadPercent: ((message.ap - message.bp) / message.bp) * 100,
      timestamp: message.t,
      orderFlow: this.calculateOrderFlow(message),
      imbalance: (message.bs - message.as) / (message.bs + message.as)
    };

    this.level2Cache.set(ticker, level2Data);
    this.onLevel2Update?.(level2Data);
  }

  private handleSecondAggregateMessage(message: any) {
    // Use second aggregates for more granular pattern detection
    const ticker = message.sym;
    if (!ticker) return;

    const candlestick: CandlestickData = {
      timestamp: message.t,
      open: message.o,
      high: message.h,
      low: message.l,
      close: message.c,
      volume: message.v
    };

    const existing = this.marketMetrics.get(ticker);
    if (existing) {
      existing.candlestickData.push(candlestick);
      // Keep only last 100 candles for pattern recognition
      if (existing.candlestickData.length > 100) {
        existing.candlestickData = existing.candlestickData.slice(-100);
      }
      this.marketMetrics.set(ticker, existing);
    }
  }

  private calculateOrderFlow(quote: any): 'buying' | 'selling' | 'neutral' {
    const bidSize = quote.bs || 0;
    const askSize = quote.as || 0;
    const ratio = bidSize / (askSize || 1);
    
    if (ratio > 1.2) return 'buying';
    if (ratio < 0.8) return 'selling';
    return 'neutral';
  }

  private checkVolumeSurge(ticker: string, metrics: MarketMetrics) {
    if (metrics.volumeRatio > 5) { // 5x volume surge
      const surge: VolumeProfile = {
        ticker,
        todayVolume: metrics.volume,
        avgVolume30D: metrics.volume / metrics.volumeRatio,
        relativeVolume: metrics.volumeRatio,
        volumeSpikes: [metrics.volume],
        unusualActivity: true,
        institutionalFlow: 0
      };
      
      this.volumeProfiles.set(ticker, surge);
      this.onVolumeSurge?.(ticker, surge);
    }
  }

  private runPatternRecognition(ticker: string, metrics: MarketMetrics) {
    if (metrics.candlestickData.length < 10) return;

    const patterns = this.patternRecognizer.detectAllPatterns(ticker, metrics.candlestickData);
    patterns.forEach((pattern: DetectedPattern) => {
      this.onPatternDetected?.(ticker, pattern);
    });
  }

  private updateStockData(ticker: string, metrics: MarketMetrics) {
    const buyScore = this.calculateBuyScore(metrics);
    
    const stock: Partial<Stock> = {
      ticker,
      price: metrics.price,
      todaysChange: metrics.price - metrics.dayOpen,
      todaysChangePerc: metrics.priceChangePercent,
      day: {
        v: metrics.volume,
        o: metrics.dayOpen,
        h: metrics.dayHigh,
        l: metrics.dayLow,
        c: metrics.price,
        vw: metrics.vwap
      },
      relVol: metrics.volumeRatio,
      buy_score: buyScore,
      volumeSurge: metrics.volumeRatio > 5,
      hasCatalyst: this.checkForCatalyst(ticker)
    };

    this.onStockUpdate?.(stock);
    
    // Check if stock meets scanning criteria for alerts
    if (this.meetsAlertCriteria(metrics, buyScore)) {
      this.onAlert?.({
        id: Date.now(),
        severity: buyScore > 80 ? 'critical' : 'warning',
        ticker,
        message: `🎯 High buy score: ${buyScore.toFixed(0)} | Volume: ${metrics.volumeRatio.toFixed(1)}x | Change: ${metrics.priceChangePercent.toFixed(1)}%`,
        timestamp: Date.now()
      });
    }
  }

  private calculateBuyScore(metrics: MarketMetrics): number {
    let score = 0;
    const criteria = this.buyScoreCriteria;

    // Relative volume score (target >5x)
    const relVolScore = Math.min(100, (metrics.volumeRatio / 5) * 100);
    score += (relVolScore * criteria.relativeVolumeWeight) / 100;

    // Price change score (target >10%)
    const priceChangeScore = Math.min(100, (Math.abs(metrics.priceChangePercent) / 10) * 100);
    score += (priceChangeScore * criteria.priceChangeWeight) / 100;

    // Price range score ($2-$20 preferred)
    let priceRangeScore = 0;
    if (metrics.price >= 2 && metrics.price <= 20) {
      priceRangeScore = 100;
    } else if (metrics.price > 20 && metrics.price <= 50) {
      priceRangeScore = 70;
    } else if (metrics.price >= 1 && metrics.price < 2) {
      priceRangeScore = 50;
    }
    score += (priceRangeScore * criteria.priceRangeWeight) / 100;

    // Volume surge bonus
    if (metrics.volumeRatio > 5) {
      score += criteria.volumeSurgeWeight;
    }

    // Pattern recognition bonus
    const patterns = this.patternRecognizer.detectAllPatterns(metrics.ticker, metrics.candlestickData);
    if (patterns.length > 0) {
      const avgConfidence = patterns.reduce((sum: number, p: DetectedPattern) => sum + p.confidence, 0) / patterns.length;
      score += (avgConfidence / 100) * criteria.patternWeight;
    }

    return Math.min(100, score);
  }

  private checkForCatalyst(ticker: string): boolean {
    // This would check for news catalysts
    // For now, return true for high-volume stocks
    const metrics = this.marketMetrics.get(ticker);
    return metrics ? metrics.volumeRatio > 3 : false;
  }

  private meetsAlertCriteria(metrics: MarketMetrics, buyScore: number): boolean {
    return (
      buyScore > 70 &&
      metrics.volumeRatio > this.scanningCriteria.minRelativeVolume &&
      Math.abs(metrics.priceChangePercent) > this.scanningCriteria.minPriceChangePercent &&
      metrics.price >= this.scanningCriteria.minPrice &&
      metrics.price <= this.scanningCriteria.maxPrice
    );
  }

  private startRealTimeScanning() {
    console.log('🚀 Starting real-time advanced scanning...');
    
    // Scan every 15 seconds
    setInterval(() => {
      this.performMarketScan();
    }, this.scanInterval);
  }

  private async performMarketScan() {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanInterval) return;

    this.lastScanTime = now;
    const stocks: Stock[] = [];

    this.marketMetrics.forEach((metrics, ticker) => {
      const buyScore = this.calculateBuyScore(metrics);
      
      if (buyScore > 50) { // Only include stocks with decent scores
        const stock: Stock = {
          ticker,
          price: metrics.price,
          todaysChange: metrics.price - metrics.dayOpen,
          todaysChangePerc: metrics.priceChangePercent,
          day: {
            v: metrics.volume,
            o: metrics.dayOpen,
            h: metrics.dayHigh,
            l: metrics.dayLow,
            c: metrics.price,
            vw: metrics.vwap
          },
          relVol: metrics.volumeRatio,
          float: 0, // Would need to fetch from API
          buy_score: buyScore,
          hasCatalyst: this.checkForCatalyst(ticker),
          volumeSurge: metrics.volumeRatio > 5
        };
        stocks.push(stock);
      }
    });

    // Sort by buy score
    stocks.sort((a, b) => b.buy_score - a.buy_score);
    
    this.onMarketScan?.(stocks.slice(0, 50)); // Top 50 stocks
  }

  // Public methods
  public connect(): void {
    if (!this._isConnected) {
      this.setupWebSocket();
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.stocksWS) {
      this.stocksWS.close();
    }
    this._isConnected = false;
    this.onConnectionChange?.(false);
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public getWatchlistSize(): number {
    return this.watchlist.size;
  }

  public updateCriteria(criteria: Partial<ScanningCriteria>): void {
    this.scanningCriteria = { ...this.scanningCriteria, ...criteria };
    console.log('📊 Updated scanning criteria:', this.scanningCriteria);
  }

  public getLevel2Data(): Map<string, Level2Data> {
    return this.level2Cache;
  }

  public getVolumeProfiles(): Map<string, VolumeProfile> {
    return this.volumeProfiles;
  }

  public cleanup(): void {
    this.disconnect();
    this.marketMetrics.clear();
    this.watchlist.clear();
    this.level2Cache.clear();
    this.volumeProfiles.clear();
    this.newsCache.clear();
    this.detailsCache.clear();
  }
}

// Singleton instance
let scannerInstance: EnhancedPolygonScanner | null = null;

export const getEnhancedPolygonScanner = (
  apiKey: string, 
  criteria?: Partial<ScanningCriteria>
): EnhancedPolygonScanner => {
  if (!scannerInstance) {
    scannerInstance = new EnhancedPolygonScanner(apiKey, criteria);
  }
  return scannerInstance;
};

export const resetScanner = (): void => {
  if (scannerInstance) {
    scannerInstance.cleanup();
    scannerInstance = null;
  }
};