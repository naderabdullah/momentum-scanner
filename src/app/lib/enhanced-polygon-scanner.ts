// src/app/lib/enhanced-polygon-scanner.ts
import { websocketClient } from "@polygon.io/client-js";
import { Stock, Alert, Level2Data, BuyScoreCriteria, CandlestickData, VolumeProfile, DetectedPattern } from './types';
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

interface WebSocketMessage {
  ev: string;
  sym?: string;
  p?: number;
  s?: number;
  t?: number;
  c?: number;
  v?: number;
  o?: number;
  h?: number;
  l?: number;
  vw?: number;
  n?: number;
  bp?: number;
  bs?: number;
  ap?: number;
  as?: number;
  status?: string;
  message?: string;
}

export class EnhancedPolygonScanner {
  private stocksWS: any = null;
  private apiKey: string;
  private restClient: unknown = null;
  private _isConnected: boolean = false;
  private marketMetrics: Map<string, MarketMetrics> = new Map();
  private watchlist: Set<string> = new Set();
  private scanningCriteria: ScanningCriteria;
  private buyScoreCriteria: BuyScoreCriteria;
  private patternRecognizer: AdvancedPatternRecognizer;
  private volumeProfiles: Map<string, VolumeProfile> = new Map();
  private level2Cache: Map<string, Level2Data> = new Map();
  private newsCache: Map<string, CachedData<unknown[]>> = new Map();
  private detailsCache: Map<string, CachedData<unknown>> = new Map();
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
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Polygon API key is required');
    }
    this.apiKey = apiKey;

    try {
      const polygonClient = websocketClient(apiKey, 'wss://socket.polygon.io');
      this.stocksWS = polygonClient.stocks();
      
      import("@polygon.io/client-js").then(({ restClient }) => {
        this.restClient = restClient(apiKey);
      }).catch(error => {
        console.error('Failed to initialize REST client:', error);
      });
    } catch (error) {
      console.error('Failed to initialize Polygon WebSocket client:', error);
      throw error;
    }

    this.buyScoreCriteria = {
      relativeVolumeWeight: 30,
      priceChangeWeight: 25,
      floatWeight: 20,
      priceRangeWeight: 10,
      newsCatalystWeight: 10,
      patternWeight: 3,
      volumeSurgeWeight: 2,
      level2Weight: 0,
      momentumWeight: 0
    };

    this.scanningCriteria = {
      minVolume: 500000,
      minRelativeVolume: 5,
      minPriceChangePercent: 10,
      minPrice: 2,
      maxPrice: 20,
      maxFloat: 20000000,
      requireNews: false,
      ...criteria
    };

    this.patternRecognizer = AdvancedPatternRecognizer.getInstance();
    
    setTimeout(() => {
      this.setupWebSocket();
    }, 1000);
  }

  private setupWebSocket() {
    try {
      console.log('🔌 Setting up Enhanced Polygon WebSocket connection...');
      
      if (!this.stocksWS) {
        console.error('❌ Cannot setup WebSocket: stocksWS is null');
        this.onError?.('WebSocket client not initialized');
        return;
      }

      this.stocksWS.onopen = () => {
        console.log("✅ Enhanced Polygon WebSocket connected successfully");
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
        // Only authenticate, don't subscribe to data until scanning starts
        this.authenticateConnection();
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
        
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        
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

      this.stocksWS.onerror = (error: Event) => {
        console.error('❌ Polygon WebSocket error:', error);
        this.onError?.('WebSocket connection error');
      };
    } catch (error) {
      console.error('❌ Failed to setup WebSocket:', error);
      this.onError?.('Failed to setup WebSocket connection');
    }
  }

  private authenticateConnection() {
    if (!this.stocksWS) return;

    try {
      const authMessage = {
        action: 'auth',
        params: this.apiKey
      };
      console.log('🔐 Sending authentication message...');
      this.stocksWS.send(JSON.stringify(authMessage));
    } catch (error) {
      console.error('❌ Failed to authenticate:', error);
    }
  }

  private subscribeToMarketData() {
    if (!this.stocksWS) return;

    try {
      console.log('📡 Subscribing to market data streams...');
      
      const subscriptions = [
        'T.*',   // All trades
        'AM.*',  // All minute aggregates
        'Q.*',   // All quotes
        'A.*'    // All second aggregates
      ];

      const subscribeMessage = {
        action: 'subscribe',
        params: subscriptions.join(',')
      };

      this.stocksWS.send(JSON.stringify(subscribeMessage));
    } catch (error) {
      console.error('❌ Failed to subscribe to market data:', error);
    }
  }

  private unsubscribeFromMarketData() {
    if (!this.stocksWS) return;

    try {
      console.log('📡 Unsubscribing from market data streams...');
      
      const subscriptions = ['T.*', 'AM.*', 'Q.*', 'A.*'];

      subscriptions.forEach(sub => {
        const unsubscribeMessage = {
          action: 'unsubscribe',
          params: sub
        };
        this.stocksWS.send(JSON.stringify(unsubscribeMessage));
      });
    } catch (error) {
      console.error('❌ Failed to unsubscribe from market data:', error);
    }
  }

  private handleMessage(message: WebSocketMessage) {
    if (!message || !message.ev) return;

    switch (message.ev) {
      case 'status':
        this.handleStatusMessage(message);
        break;
      case 'T':
        this.handleTradeMessage(message);
        break;
      case 'AM':
        this.handleAggregateMessage(message);
        break;
      case 'Q':
        this.handleQuoteMessage(message);
        break;
      case 'A':
        this.handleSecondAggregateMessage(message);
        break;
    }
  }

  private handleStatusMessage(message: WebSocketMessage) {
    if (message.status === 'auth_success') {
      console.log('✅ Authentication successful');
      this.onAlert?.({
        id: Date.now() + Math.random(),
        severity: 'info',
        ticker: 'SYSTEM',
        message: '🔐 Authentication successful - ready to scan',
        timestamp: Date.now()
      });
    }
  }

  private handleTradeMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.p || !message.s) return;

    const existing = this.marketMetrics.get(ticker);
    const trade = {
      ticker,
      price: message.p,
      volume: message.s,
      timestamp: message.t || Date.now(),
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
  }

  private handleAggregateMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.c || !message.v || !message.o) return;

    const aggregate = {
      ticker,
      price: message.c,
      volume: message.v,
      volumeRatio: message.v / 1000000, // Simplified
      priceChangePercent: ((message.c - message.o) / message.o) * 100,
      dayOpen: message.o,
      dayHigh: message.h || message.c,
      dayLow: message.l || message.c,
      vwap: message.vw || message.c,
      timestamp: message.t || Date.now(),
      trades: message.n || 0,
      candlestickData: []
    };

    this.marketMetrics.set(ticker, aggregate);
    this.updateStockData(ticker, aggregate);
  }

  private handleQuoteMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.bp || !message.ap || !message.bs || !message.as) return;

    const level2Data: Level2Data = {
      ticker,
      bid_price: message.bp,
      bid_size: message.bs,
      ask_price: message.ap,
      ask_size: message.as,
      spread: message.ap - message.bp,
      spreadPercent: ((message.ap - message.bp) / message.bp) * 100,
      timestamp: message.t || Date.now(),
      orderFlow: message.bs > message.as ? 'buying' : message.as > message.bs ? 'selling' : 'neutral'
    };

    this.level2Cache.set(ticker, level2Data);
    this.onLevel2Update?.(level2Data);
  }

  private handleSecondAggregateMessage(message: WebSocketMessage) {
    this.handleAggregateMessage(message);
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
      float: 0,
      buy_score: buyScore,
      hasCatalyst: this.checkForCatalyst(ticker),
      volumeSurge: metrics.volumeRatio > 5
    };

    this.onStockUpdate?.(stock);
    
    if (this.meetsAlertCriteria(metrics, buyScore)) {
      this.onAlert?.({
        id: Date.now() + Math.random(),
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

    const relVolScore = Math.min(100, (metrics.volumeRatio / 5) * 100);
    score += (relVolScore * criteria.relativeVolumeWeight) / 100;

    const priceChangeScore = Math.min(100, (Math.abs(metrics.priceChangePercent) / 10) * 100);
    score += (priceChangeScore * criteria.priceChangeWeight) / 100;

    let priceRangeScore = 0;
    if (metrics.price >= 2 && metrics.price <= 20) {
      priceRangeScore = 100;
    } else if (metrics.price > 20 && metrics.price <= 50) {
      priceRangeScore = 70;
    } else if (metrics.price >= 1 && metrics.price < 2) {
      priceRangeScore = 50;
    }
    score += (priceRangeScore * criteria.priceRangeWeight) / 100;

    if (metrics.volumeRatio > 5) {
      score += criteria.volumeSurgeWeight;
    }

    return Math.min(100, score);
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

  private checkForCatalyst(ticker: string): boolean {
    const metrics = this.marketMetrics.get(ticker);
    return metrics ? metrics.volumeRatio > 3 : false;
  }

  private startRealTimeScanning() {
    console.log('🚀 Starting real-time scanning...');
    
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
        float: 0,
        buy_score: buyScore,
        hasCatalyst: this.checkForCatalyst(ticker),
        volumeSurge: metrics.volumeRatio > 5
      };
      stocks.push(stock);
    });

    stocks.sort((a, b) => b.buy_score - a.buy_score);
    this.onMarketScan?.(stocks.slice(0, 50));
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

  public startScanning(): void {
    this.subscribeToMarketData();
    this.startRealTimeScanning();
  }

  public stopScanning(): void {
    this.unsubscribeFromMarketData();
    console.log('⏹️ Stopped scanning and unsubscribed from market data');
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