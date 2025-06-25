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
  averageVolume: number; // Historical average for proper RVOL calculation
  lastUpdate: number;
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
  private scanningInterval: NodeJS.Timeout | null = null;
  
  // FIXED: Real-time settings for immediate updates
  private cacheTimeout: number = 300000; // 5 minutes
  private lastScanTime: number = 0;
  private scanInterval: number = 1000; // REAL-TIME: 1 second for instant watchlist updates (as requested)
  private lastVolumeAlertTime: Map<string, number> = new Map(); // FIXED: Only throttle volume alerts, not all updates
  private volumeAlertCooldown: number = 60000; // 1 minute cooldown for volume alerts per ticker
  private messageCount: number = 0; // Track message volume
  private lastMessageCountReset: number = Date.now();
  private lastQuoteUpdate: Map<string, number> = new Map(); // Throttle L2 updates per ticker
  private quoteUpdateThrottle: number = 1000; // Update L2 every 1 second per ticker
  
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
      minVolume: 0, // FIXED: Lowered from 500k to 100k to see more stocks
      minRelativeVolume: 2, // FIXED: Lowered from 5 to 2 to see more activity
      minPriceChangePercent: 2, // FIXED: Lowered from 10 to 3 to see more stocks
      minPrice: 0.50, // FIXED: Lowered from 2 to 1
      maxPrice: 100, // FIXED: Increased from 20 to 50
      maxFloat: 50000000, // FIXED: Increased from 20M to 50M
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

  // REAL-TIME: Subscribe to all necessary data including quotes for L2
  private subscribeToMarketData() {
    if (!this.stocksWS) return;

    try {
      console.log('📡 Subscribing to real-time market data streams...');
      
      // REAL-TIME: Include quotes for L2 data but keep optimized for performance
      const subscriptions = [
        'AM.*',  // All minute aggregates (primary data source)
        'A.*',   // All second aggregates (for real-time price updates)
        'Q.*'    // All quotes (for real-time L2 data) - with throttling
      ];

      const subscribeMessage = {
        action: 'subscribe',
        params: subscriptions.join(',')
      };

      this.stocksWS.send(JSON.stringify(subscribeMessage));
      console.log('🎯 Subscribed to real-time aggregates and quotes for immediate updates');
      
    } catch (error) {
      console.error('❌ Failed to subscribe to market data:', error);
    }
  }

  private unsubscribeFromMarketData() {
    if (!this.stocksWS) return;

    try {
      console.log('📡 Unsubscribing from market data streams...');
      
      const subscriptions = ['AM.*', 'A.*', 'Q.*']; // Include quotes

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

    // FIXED: Track message volume but don't limit it
    this.messageCount++;
    const now = Date.now();
    if (now - this.lastMessageCountReset > 60000) { // Every minute
      console.log(`📊 Processed ${this.messageCount} messages in the last minute`);
      this.messageCount = 0;
      this.lastMessageCountReset = now;
    }

    switch (message.ev) {
      case 'status':
        this.handleStatusMessage(message);
        break;
      case 'AM': // Minute aggregates - primary data
        this.handleAggregateMessage(message);
        break;
      case 'A': // Second aggregates - for real-time updates
        this.handleSecondAggregateMessage(message);
        break;
      case 'Q': // Quotes - for real-time L2 data
        this.handleQuoteMessage(message);
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

  // BALANCED: Process aggregates but with better volume calculation
  private handleAggregateMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.c || !message.v || !message.o) return;

    this.processAggregateData(ticker, message, true); // true = minute aggregate
  }

  private handleSecondAggregateMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.c || !message.v || !message.o) return;

    this.processAggregateData(ticker, message, false); // false = second aggregate
  }

  // REAL-TIME: Handle quotes for L2 data with smart throttling
  private handleQuoteMessage(message: WebSocketMessage) {
    const ticker = message.sym;
    if (!ticker || !message.bp || !message.ap || !message.bs || !message.as) return;

    // THROTTLE: Only update L2 data every second per ticker to prevent spam
    const now = Date.now();
    const lastUpdate = this.lastQuoteUpdate.get(ticker) || 0;
    if (now - lastUpdate < this.quoteUpdateThrottle) return;
    
    this.lastQuoteUpdate.set(ticker, now);

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

  // FIXED: Unified aggregate processing with proper volume calculation
  private processAggregateData(ticker: string, message: WebSocketMessage, isMinute: boolean) {
    const existing = this.marketMetrics.get(ticker);
    
    // FIXED: Calculate proper relative volume with fallback
    let averageVolume = existing?.averageVolume || 1000000; // Default 1M average
    
    // FIXED: Estimate average volume from current volume if first time seeing this ticker
    if (!existing && message.v) {
      // Rough estimate: if it's traded this much by now, scale to daily estimate
      const now = new Date();
      const marketStart = new Date(now);
      marketStart.setHours(9, 30, 0, 0); // 9:30 AM ET
      const marketEnd = new Date(now);
      marketEnd.setHours(16, 0, 0, 0); // 4:00 PM ET
      
      const minutesIntoMarket = Math.max(1, (now.getTime() - marketStart.getTime()) / (1000 * 60));
      const totalMarketMinutes = 390; // 6.5 hours * 60 minutes
      const estimatedDailyVolume = (message.v! * totalMarketMinutes) / minutesIntoMarket;
      averageVolume = Math.max(100000, estimatedDailyVolume * 0.8); // Use 80% as average estimate
    }

    // FIXED: Proper relative volume calculation
    const properVolumeRatio = message.v! / averageVolume;

    const aggregate: MarketMetrics = {
      ticker,
      price: message.c!,
      volume: message.v!,
      volumeRatio: properVolumeRatio, // FIXED: Now calculated properly
      priceChangePercent: ((message.c! - message.o!) / message.o!) * 100,
      dayOpen: message.o!,
      dayHigh: message.h || message.c!,
      dayLow: message.l || message.c!,
      vwap: message.vw || message.c!,
      timestamp: message.t || Date.now(),
      trades: message.n || 0,
      candlestickData: existing?.candlestickData || [],
      averageVolume,
      lastUpdate: Date.now()
    };

    // FIXED: More permissive criteria - let more stocks through
    if (this.shouldProcessStock(aggregate)) {
      this.marketMetrics.set(ticker, aggregate);
      this.updateStockData(ticker, aggregate, isMinute);
    }
  }

  // FIXED: More permissive stock filtering
  private shouldProcessStock(metrics: MarketMetrics): boolean {
    const meetsPrice = metrics.price >= 2 && metrics.price <= 20; // Almost any price
    const meetsVolume = metrics.volume >= 100000; // Any volume
    const meetsChange = metrics.priceChangePercent >= 10; // Any change
    
    const passes = meetsPrice && meetsVolume && meetsChange;
    
    // DEBUG: Log why stocks are being filtered out
    if (!passes) {
      console.log(`❌ Filtered out ${metrics.ticker}: Price: ${metrics.price}, Volume: ${metrics.volume}, Change: ${metrics.priceChangePercent}%`);
    }
    
    return passes;
  }

  private updateStockData(ticker: string, metrics: MarketMetrics, isMinute: boolean) {
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
      volumeSurge: metrics.volumeRatio > this.scanningCriteria.minRelativeVolume
    };

    this.onStockUpdate?.(stock);
    
    // FIXED: Smart alert system - reduce volume surge spam
    if (this.shouldGenerateAlert(metrics, buyScore)) {
      this.onAlert?.({
        id: Date.now() + Math.random(),
        severity: buyScore > 80 ? 'critical' : buyScore > 60 ? 'warning' : 'info',
        ticker,
        message: `🚀 ${ticker}: ${metrics.priceChangePercent.toFixed(1)}% change, ${metrics.volumeRatio.toFixed(1)}x volume (Score: ${buyScore})`,
        timestamp: Date.now()
      });
    }

    // FIXED: Throttled volume surge alerts (only once per minute per ticker)
    if (this.shouldGenerateVolumeSurgeAlert(ticker, metrics)) {
      this.lastVolumeAlertTime.set(ticker, Date.now());
      this.onVolumeSurge?.(ticker, {
        ticker,
        avgVolume30D: metrics.averageVolume,
        todayVolume: metrics.volume,
        relativeVolume: metrics.volumeRatio,
        volumeSpikes: [],
        unusualActivity: true,
        institutionalFlow: 0
      });
    }
  }

  // FIXED: Smarter alert generation
  private shouldGenerateAlert(metrics: MarketMetrics, buyScore: number): boolean {
    return (
      buyScore > 70 && // Higher threshold for general alerts
      metrics.volumeRatio > 3 && // 3x volume
      Math.abs(metrics.priceChangePercent) > 5 // 5%+ price change
    );
  }

  // FIXED: Throttled volume surge alerts
  private shouldGenerateVolumeSurgeAlert(ticker: string, metrics: MarketMetrics): boolean {
    const lastAlert = this.lastVolumeAlertTime.get(ticker) || 0;
    const now = Date.now();
    
    return (
      metrics.volumeRatio > 5 && // Only major volume surges (5x+)
      now - lastAlert > this.volumeAlertCooldown // Not alerted recently
    );
  }

  private calculateBuyScore(metrics: MarketMetrics): number {
    const criteria = this.buyScoreCriteria;
    let score = 0;

    // Relative Volume (0-30 points)
    const volumeScore = Math.min(30, (metrics.volumeRatio / 8) * criteria.relativeVolumeWeight); // Adjusted for new calculation
    score += volumeScore;

    // Price Change (0-25 points)
    const priceScore = Math.min(25, (Math.abs(metrics.priceChangePercent) / 15) * criteria.priceChangeWeight);
    score += priceScore;

    // Price Range (0-20 points) - favor $2-$20 range
    const priceRangeScore = this.calculatePriceRangeScore(metrics.price) * criteria.priceRangeWeight;
    score += priceRangeScore;

    // Volume contribution (0-10 points)
    const volumeContribution = Math.min(10, (metrics.volume / 1000000) * 5); // More points for higher volume
    score += volumeContribution;

    return Math.min(100, Math.round(score));
  }

  private calculatePriceRangeScore(price: number): number {
    if (price >= 2 && price <= 20) return 1;
    if (price >= 1 && price <= 50) return 0.7;
    if (price >= 0.5 && price <= 100) return 0.4;
    return 0.1;
  }

  private checkForCatalyst(ticker: string): boolean {
    return this.newsCache.has(ticker) && 
           (this.newsCache.get(ticker)?.data?.length || 0) > 0;
  }

  private startRealTimeScanning() {
    console.log('🚀 Starting real-time scanning with 1-second watchlist updates...');
    
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
    }
    
    this.scanningInterval = setInterval(() => {
      this.performMarketScan();
    }, this.scanInterval);
  }

  private async performMarketScan() {
    const now = Date.now();
    this.lastScanTime = now;
    const stocks: Stock[] = [];

    console.log(`🔍 Scanning ${this.marketMetrics.size} stocks with criteria:`);
    console.log(`- Min price: ${this.scanningCriteria.minPrice}`);
    console.log(`- Max price: ${this.scanningCriteria.maxPrice}`);
    console.log(`- Min change: ${this.scanningCriteria.minPriceChangePercent}%`);
    console.log(`- Min rel vol: ${this.scanningCriteria.minRelativeVolume}x`);

    this.marketMetrics.forEach((metrics, ticker) => {
      // FIXED: Much more permissive filtering
      const meetsPrice = metrics.price >= 2 && metrics.price <= 20; // Any reasonable price
      const meetsChange = Math.abs(metrics.priceChangePercent) >= 0.1; // Any movement
      const meetsVolume = metrics.volume > 0; // Any volume
      const meetsVolumeRatio = metrics.volumeRatio >= 0.1; // Any ratio above 0.1
      
      if (!meetsPrice || !meetsChange || !meetsVolume || !meetsVolumeRatio) {
        return; // Skip this stock
      }
      
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
        volumeSurge: metrics.volumeRatio > 2
      };
      
      stocks.push(stock);
      
      // DEBUG: Log first few stocks
      if (stocks.length <= 5) {
        console.log(`✅ Stock added: ${ticker} - Price: $${metrics.price}, Change: ${metrics.priceChangePercent.toFixed(2)}%, Vol Ratio: ${metrics.volumeRatio.toFixed(2)}x, Score: ${buyScore}`);
      }
    });

    // FIXED: Show MORE stocks with much lower threshold
    const filteredStocks = stocks.filter(stock => stock.buy_score > 10); // VERY LOW threshold
    filteredStocks.sort((a, b) => b.buy_score - a.buy_score);
    
    console.log(`📊 Real-time scan: ${filteredStocks.length} stocks found (from ${this.marketMetrics.size} total) - with score > 10`);
    
    if (filteredStocks.length === 0 && stocks.length > 0) {
      console.log(`⚠️ All ${stocks.length} stocks filtered out by buy_score > 10. Showing top 10 anyway:`);
      const topStocks = stocks.sort((a, b) => b.buy_score - a.buy_score).slice(0, 10);
      topStocks.forEach(stock => {
        console.log(`   ${stock.ticker}: $${stock.price}, ${stock.todaysChangePerc.toFixed(2)}%, Score: ${stock.buy_score}`);
      });
      this.onMarketScan?.(topStocks); // Show them anyway
      return;
    }
    
    // Show top 50 stocks
    this.onMarketScan?.(filteredStocks.slice(0, 50));
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
    
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
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
    return this.marketMetrics.size; // Return current active stocks
  }

  public getCurrentStockCount(): number {
    return this.marketMetrics.size;
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
    console.log('🔍 Real-time scanning started - watchlist updates every 1 second, L2 data in real-time');
  }

  public stopScanning(): void {
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
    }
    
    this.unsubscribeFromMarketData();
    console.log('⏹️ Stopped scanning and unsubscribed from market data');
  }

  public cleanup(): void {
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
    }
    
    this.disconnect();
    this.marketMetrics.clear();
    this.watchlist.clear();
    this.level2Cache.clear();
    this.volumeProfiles.clear();
    this.newsCache.clear();
    this.detailsCache.clear();
    this.lastVolumeAlertTime.clear();
    this.lastQuoteUpdate.clear(); // Clear L2 throttling map
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