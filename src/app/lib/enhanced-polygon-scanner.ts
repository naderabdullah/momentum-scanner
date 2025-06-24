// src/app/lib/enhanced-polygon-scanner.ts
import { websocketClient } from "@polygon.io/client-js";
import { Stock, Alert, Level2Data, PatternData, UserPlan, BuyScoreCriteria, CandlestickData, VolumeProfile, DetectedPattern } from './types';
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
  private userPlan: UserPlan;
  private patternRecognizer: AdvancedPatternRecognizer;
  private volumeProfiles: Map<string, VolumeProfile> = new Map();
  private level2Cache: Map<string, Level2Data> = new Map();
  private newsCache: Map<string, CachedData<any[]>> = new Map();
  private detailsCache: Map<string, CachedData<any>> = new Map();
  
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

  constructor(apiKey: string, userPlan?: UserPlan, criteria?: Partial<ScanningCriteria>) {
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

    // Set user plan with feature flags
    this.userPlan = userPlan || {
      level: 'basic',
      features: {
        level2Data: false,
        patternRecognition: false,
        volumeSurgeDetection: true,
        orderFlowAnalysis: false,
        realTimeNews: false,
        advancedScreening: false,
        customAlerts: true
      }
    };

    // Enhanced buy score criteria based on user requirements
    this.buyScoreCriteria = {
      relativeVolumeWeight: 30,  // 30% weight - target >5x
      priceChangeWeight: 25,     // 25% weight - target >10%
      floatWeight: 20,           // 20% weight - target <20M
      priceRangeWeight: 10,      // 10% weight - target $2-$20
      newsCatalystWeight: 10,    // 10% weight - has news
      patternWeight: 3,          // 3% weight - technical patterns
      volumeSurgeWeight: 2       // 2% weight - volume surge
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
    this.stocksWS.onopen = () => {
      console.log("Enhanced Polygon WebSocket connected");
      this._isConnected = true;
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
      console.log("Polygon WebSocket disconnected:", event.code, event.reason);
      this._isConnected = false;
      this.onConnectionChange?.(false);
      
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (!this._isConnected) {
          console.log("Attempting to reconnect...");
          this.setupWebSocket();
        }
      }, 5000);
    };

    this.stocksWS.onerror = (error: any) => {
      console.error('Polygon WebSocket error:', error);
      this.onError?.('WebSocket connection error');
    };
  }

  private subscribeToMarketData() {
    if (!this.stocksWS || this.stocksWS.readyState !== WebSocket.OPEN) {
      console.error('Cannot subscribe: WebSocket not open');
      return;
    }

    try {
      console.log('Subscribing to Polygon market data streams...');
      
      // Subscribe to trades and aggregates for real-time scanning
      const subscriptions = [
        'T.*',  // All trades
        'AM.*'  // All minute aggregates
      ];

      // Add Level 2 quotes if user has advanced plan
      if (this.userPlan.features.level2Data) {
        subscriptions.push('Q.*'); // All quotes
        console.log('Advanced plan detected - subscribing to Level 2 data');
      }

      const subscribeMessage = {
        action: 'subscribe',
        params: subscriptions.join(',')
      };

      console.log('Sending subscription message:', subscribeMessage);
      this.stocksWS.send(JSON.stringify(subscribeMessage));
      
      // Send authentication message
      const authMessage = {
        action: 'auth',
        params: process.env.NEXT_PUBLIC_POLYGON_API_KEY
      };
      
      console.log('Sending authentication message...');
      this.stocksWS.send(JSON.stringify(authMessage));
      
    } catch (error) {
      console.error('Failed to subscribe to market data:', error);
      this.onError?.('Failed to subscribe to market data streams');
    }
  }

  private handleMessage(message: any) {
    try {
      switch (message.ev) {
        case 'T': // Trade
          this.handleTrade(message);
          break;
        case 'Q': // Quote
          this.handleQuote(message);
          break;
        case 'AM': // Aggregate minute
          this.handleAggregate(message);
          break;
        case 'status':
          this.handleStatus(message);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  private handleTrade(trade: any) {
    const ticker = trade.sym;
    const price = trade.p;
    const volume = trade.s;
    const timestamp = trade.t;

    // Update market metrics
    this.updateMarketMetrics(ticker, { price, volume, timestamp, type: 'trade' });
    
    // Check for volume surge if enabled
    if (this.userPlan.features.volumeSurgeDetection) {
      this.checkVolumeSurge(ticker, volume);
    }
  }

  private handleQuote(quote: any) {
    const ticker = quote.sym;
    
    // Update Level 2 data if user has access
    if (this.userPlan.features.level2Data) {
      const level2Data: Level2Data = {
        ticker,
        bid_price: quote.bp,
        bid_size: quote.bs,
        ask_price: quote.ap,
        ask_size: quote.as,
        spread: quote.ap - quote.bp,
        spreadPercent: ((quote.ap - quote.bp) / quote.bp) * 100,
        timestamp: quote.t,
        imbalance: (quote.bs - quote.as) / (quote.bs + quote.as),
        orderFlow: this.determineOrderFlow(quote.bs, quote.as)
      };
      
      this.level2Cache.set(ticker, level2Data);
      this.onLevel2Update?.(level2Data);
    }
  }

  private handleAggregate(agg: any) {
    const ticker = agg.sym;
    this.updateMarketMetrics(ticker, {
      price: agg.c,
      volume: agg.v,
      dayOpen: agg.o,
      dayHigh: agg.h,
      dayLow: agg.l,
      vwap: agg.vw,
      timestamp: agg.e,
      type: 'aggregate'
    });
  }

  private handleStatus(status: any) {
    console.log('WebSocket status:', status);
    if (status.status === 'auth_success') {
      this.onAlert?.({
        id: Date.now(),
        severity: 'info',
        ticker: 'SYSTEM',
        message: 'Successfully authenticated with Polygon WebSocket',
        timestamp: Date.now(),
        alertType: 'system'
      });
    }
  }

  private updateMarketMetrics(ticker: string, update: any) {
    const existing = this.marketMetrics.get(ticker) || {
      ticker,
      price: 0,
      volume: 0,
      volumeRatio: 0,
      priceChangePercent: 0,
      dayOpen: 0,
      dayHigh: 0,
      dayLow: 0,
      vwap: 0,
      timestamp: Date.now(),
      trades: 0,
      candlestickData: []
    };

    // Update metrics
    if (update.price) existing.price = update.price;
    if (update.volume) existing.volume += update.volume;
    if (update.dayOpen) existing.dayOpen = update.dayOpen;
    if (update.dayHigh) existing.dayHigh = update.dayHigh;
    if (update.dayLow) existing.dayLow = update.dayLow;
    if (update.vwap) existing.vwap = update.vwap;
    existing.timestamp = update.timestamp || Date.now();
    existing.trades += 1;

    // Calculate price change percentage
    if (existing.dayOpen > 0) {
      existing.priceChangePercent = ((existing.price - existing.dayOpen) / existing.dayOpen) * 100;
    }

    // Update candlestick data for pattern recognition
    if (this.userPlan.features.patternRecognition && update.type === 'aggregate') {
      this.updateCandlestickData(existing, update);
    }

    this.marketMetrics.set(ticker, existing);

    // Check if stock meets criteria and should be added to watchlist
    this.evaluateStock(ticker, existing);
  }

  private updateCandlestickData(metrics: MarketMetrics, update: any) {
    const candlestick: CandlestickData = {
      open: update.dayOpen || metrics.dayOpen,
      high: update.dayHigh || metrics.dayHigh,
      low: update.dayLow || metrics.dayLow,
      close: update.price || metrics.price,
      volume: update.volume || 0,
      timestamp: update.timestamp || Date.now()
    };
    
    metrics.candlestickData.push(candlestick);
    
    // Keep only last 100 candles for memory efficiency
    if (metrics.candlestickData.length > 100) {
      metrics.candlestickData = metrics.candlestickData.slice(-100);
    }
    
    // Check for patterns if we have enough data
    if (metrics.candlestickData.length >= 20) {
      this.checkPatterns(metrics.ticker, metrics.candlestickData);
    }
  }

  private checkPatterns(ticker: string, candles: CandlestickData[]) {
    if (!this.userPlan.features.patternRecognition) return;
    
    try {
      const patterns = this.patternRecognizer.detectAllPatterns(ticker, candles);
      
      patterns.forEach(pattern => {
        this.onPatternDetected?.(ticker, pattern);
        
        // Create alert for high-confidence patterns
        if (pattern.confidence > 80) {
          this.onAlert?.({
            id: Date.now(),
            severity: 'info',
            ticker,
            message: `${pattern.name} detected (${pattern.confidence.toFixed(0)}% confidence)`,
            timestamp: Date.now(),
            alertType: 'pattern_detected'
          });
        }
      });
    } catch (error) {
      console.error(`Pattern check error for ${ticker}:`, error);
    }
  }

  private checkVolumeSurge(ticker: string, volume: number) {
    const profile = this.volumeProfiles.get(ticker);
    if (!profile) return;
    
    const currentRatio = volume / profile.avgVolume30D;
    
    if (currentRatio > 3 && !profile.unusualActivity) {
      profile.unusualActivity = true;
      profile.volumeSpikes.push(Date.now());
      
      this.onVolumeSurge?.(ticker, profile);
      this.onAlert?.({
        id: Date.now(),
        severity: 'warning',
        ticker,
        message: `Volume surge detected! ${currentRatio.toFixed(1)}x average volume`,
        timestamp: Date.now(),
        alertType: 'volume_surge'
      });
    }
  }

  private determineOrderFlow(bidSize: number, askSize: number): 'buying' | 'selling' | 'neutral' {
    const imbalance = (bidSize - askSize) / (bidSize + askSize);
    if (imbalance > 0.3) return 'buying';
    if (imbalance < -0.3) return 'selling';
    return 'neutral';
  }

  private async evaluateStock(ticker: string, metrics: MarketMetrics) {
    try {
      // Get additional data for scoring
      const [details, news, volumeProfile] = await Promise.all([
        this.getStockDetails(ticker),
        this.userPlan.features.realTimeNews ? this.getRecentNews(ticker) : Promise.resolve([]),
        this.getVolumeProfile(ticker)
      ]);

      if (!details) return;

      // Calculate relative volume
      const relVol = volumeProfile ? metrics.volume / volumeProfile.avgVolume30D : 1;
      
      // Check basic criteria
      if (!this.meetsCriteria(metrics, details, relVol)) return;

      // Calculate advanced buy score
      const buyScore = this.calculateBuyScore({
        ...metrics,
        float: details.market_cap ? details.market_cap / details.shares_outstanding : 0,
        relVol,
        hasCatalyst: news.length > 0,
        patterns: this.userPlan.features.patternRecognition ? 
          this.patternRecognizer.detectAllPatterns(ticker, metrics.candlestickData) : []
      }, news);

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
        relVol,
        float: details.market_cap ? details.market_cap / details.shares_outstanding : 0,
        buy_score: buyScore,
        hasCatalyst: news.length > 0,
        marketCap: details.market_cap,
        patterns: this.userPlan.features.patternRecognition ? 
          this.patternRecognizer.detectAllPatterns(ticker, metrics.candlestickData) : undefined,
        volumeSurge: volumeProfile?.unusualActivity || false,
        orderFlow: this.userPlan.features.orderFlowAnalysis ? 
          this.calculateOrderFlow(ticker) : undefined
      };

      this.watchlist.add(ticker);
      this.onStockUpdate?.(stock);

      // Generate alerts based on buy score
      this.checkBuySignals(stock);

    } catch (error) {
      console.error(`Failed to evaluate stock ${ticker}:`, error);
    }
  }

  private calculateBuyScore(data: any, news: any[]): number {
    let score = 0;
    const criteria = this.buyScoreCriteria;

    // Relative Volume Score (target: >5x)
    const relVolScore = Math.min(100, (data.relVol / 5) * 100);
    score += (relVolScore * criteria.relativeVolumeWeight) / 100;

    // Price Change Score (target: >10%)
    const priceChangeScore = Math.min(100, (Math.abs(data.priceChangePercent) / 10) * 100);
    score += (priceChangeScore * criteria.priceChangeWeight) / 100;

    // Float Score (target: <20M, preference for smaller)
    const floatScore = data.float < 20000000 ? 
      Math.max(0, 100 - (data.float / 20000000) * 100) : 0;
    score += (floatScore * criteria.floatWeight) / 100;

    // Price Range Score (target: $2-$20)
    const priceRangeScore = (data.price >= 2 && data.price <= 20) ? 100 : 0;
    score += (priceRangeScore * criteria.priceRangeWeight) / 100;

    // News Catalyst Score
    const newsScore = news.length > 0 ? 100 : 0;
    score += (newsScore * criteria.newsCatalystWeight) / 100;

    // Pattern Score (if enabled)
    if (this.userPlan.features.patternRecognition && data.patterns) {
      const patternScore = data.patterns.length > 0 ? 
        Math.min(100, data.patterns.reduce((sum: number, p: DetectedPattern) => sum + p.confidence, 0) / data.patterns.length) : 0;
      score += (patternScore * criteria.patternWeight) / 100;
    }

    // Volume Surge Score
    const volumeSurgeScore = data.volumeSurge ? 100 : 0;
    score += (volumeSurgeScore * criteria.volumeSurgeWeight) / 100;

    return Math.min(100, score);
  }

  private meetsCriteria(metrics: MarketMetrics, details: any, relVol: number): boolean {
    return (
      metrics.volume >= this.scanningCriteria.minVolume &&
      relVol >= this.scanningCriteria.minRelativeVolume &&
      Math.abs(metrics.priceChangePercent) >= this.scanningCriteria.minPriceChangePercent &&
      metrics.price >= this.scanningCriteria.minPrice &&
      metrics.price <= this.scanningCriteria.maxPrice &&
      (details.market_cap ? details.market_cap / details.shares_outstanding : 0) <= this.scanningCriteria.maxFloat
    );
  }

  private checkBuySignals(stock: Stock) {
    if (stock.buy_score >= 90) {
      this.onAlert?.({
        id: Date.now(),
        severity: 'critical',
        ticker: stock.ticker,
        message: `🚀 BUY SIGNAL! Score: ${stock.buy_score.toFixed(0)} | ${stock.todaysChangePerc.toFixed(1)}% | ${stock.relVol.toFixed(1)}x vol`,
        timestamp: Date.now(),
        alertType: 'buy_signal'
      });
    } else if (stock.buy_score >= 75) {
      this.onAlert?.({
        id: Date.now(),
        severity: 'warning',
        ticker: stock.ticker,
        message: `⚠️ High Score Alert! Score: ${stock.buy_score.toFixed(0)} | ${stock.todaysChangePerc.toFixed(1)}% | ${stock.relVol.toFixed(1)}x vol`,
        timestamp: Date.now(),
        alertType: 'buy_signal'
      });
    }
  }

  private async getStockDetails(ticker: string): Promise<any> {
    const cached = this.detailsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      if (this.restClient) {
        const details = await this.restClient.reference.tickerDetails(ticker);
        this.detailsCache.set(ticker, { data: details.results, timestamp: Date.now() });
        return details.results;
      }
    } catch (error) {
      // Silently handle errors to avoid spamming console
    }
    
    return null;
  }

  private async getRecentNews(ticker: string): Promise<any[]> {
    if (!this.userPlan.features.realTimeNews) return [];
    
    const cached = this.newsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      if (this.restClient) {
        const news = await this.restClient.reference.tickerNews({ ticker, limit: 5 });
        const newsResults = news.results || [];
        this.newsCache.set(ticker, { data: newsResults, timestamp: Date.now() });
        return newsResults;
      }
    } catch (error) {
      // Silently handle errors
    }
    
    return [];
  }

  private async getVolumeProfile(ticker: string): Promise<VolumeProfile | null> {
    const cached = this.volumeProfiles.get(ticker);
    if (cached) return cached;
    
    try {
      if (this.restClient) {
        // Get 30-day average volume
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const aggs = await this.restClient.stocks.aggregates(
          ticker,
          1,
          'day',
          thirtyDaysAgo.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        );
        
        if (aggs.results && aggs.results.length > 0) {
          const avgVolume = aggs.results.reduce((sum: number, day: any) => sum + day.v, 0) / aggs.results.length;
          
          const profile: VolumeProfile = {
            ticker,
            avgVolume30D: avgVolume,
            todayVolume: 0,
            relativeVolume: 0,
            volumeSpikes: [],
            unusualActivity: false,
            institutionalFlow: 0
          };
          
          this.volumeProfiles.set(ticker, profile);
          return profile;
        }
      }
    } catch (error) {
      // Silently handle errors
    }
    
    return null;
  }

  private calculateOrderFlow(ticker: string): any {
    if (!this.userPlan.features.orderFlowAnalysis) return undefined;
    
    const level2 = this.level2Cache.get(ticker);
    if (!level2) return undefined;
    
    return {
      buyPressure: level2.bid_size > level2.ask_size ? 75 : 25,
      sellPressure: level2.ask_size > level2.bid_size ? 75 : 25,
      netFlow: level2.bid_size - level2.ask_size,
      largeBlockTrades: 0, // Would need more data
      institutionalFlow: level2.orderFlow || 'neutral'
    };
  }

  private startRealTimeScanning() {
    setInterval(() => {
      this.cleanupWatchlist();
      this.performMarketScan();
    }, this.scanInterval);
  }

  private cleanupWatchlist() {
    // Remove stocks that no longer meet criteria
    const currentTime = Date.now();
    const staleThreshold = 300000; // 5 minutes
    
    Array.from(this.watchlist).forEach(ticker => {
      const metrics = this.marketMetrics.get(ticker);
      if (!metrics || currentTime - metrics.timestamp > staleThreshold) {
        this.watchlist.delete(ticker);
        this.marketMetrics.delete(ticker);
      }
    });
  }

  private async performMarketScan() {
    try {
      const stocks = Array.from(this.marketMetrics.values())
        .map(metrics => this.convertToStock(metrics))
        .filter(stock => stock !== null)
        .sort((a, b) => b.buy_score - a.buy_score)
        .slice(0, 50); // Top 50 stocks
        
      this.onMarketScan?.(stocks);
    } catch (error) {
      console.error('Market scan error:', error);
    }
  }

  private convertToStock(metrics: MarketMetrics): Stock | null {
    try {
      const details = this.detailsCache.get(metrics.ticker)?.data;
      if (!details) return null;
      
      const volumeProfile = this.volumeProfiles.get(metrics.ticker);
      const relVol = volumeProfile ? metrics.volume / volumeProfile.avgVolume30D : 1;
      const cachedNews = this.newsCache.get(metrics.ticker);
      const newsData = cachedNews ? cachedNews.data : [];
      
      return {
        ticker: metrics.ticker,
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
        relVol,
        float: details.market_cap ? details.market_cap / details.shares_outstanding : 0,
        buy_score: this.calculateBuyScore({
          ...metrics,
          float: details.market_cap ? details.market_cap / details.shares_outstanding : 0,
          relVol,
          hasCatalyst: newsData.length > 0,
          patterns: this.userPlan.features.patternRecognition ? 
            this.patternRecognizer.detectAllPatterns(metrics.ticker, metrics.candlestickData) : []
        }, newsData),
        hasCatalyst: newsData.length > 0
      };
    } catch (error) {
      return null;
    }
  }

  // Public methods
  public connect() {
    if (!this._isConnected) {
      this.setupWebSocket();
    }
  }

  public disconnect() {
    if (this.stocksWS) {
      this.stocksWS.close();
    }
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public updateCriteria(criteria: Partial<ScanningCriteria>) {
    this.scanningCriteria = { ...this.scanningCriteria, ...criteria };
    this.cleanupWatchlist();
  }

  public updateUserPlan(plan: UserPlan) {
    this.userPlan = plan;
    // Resubscribe based on new plan features
    if (this._isConnected) {
      this.subscribeToMarketData();
    }
  }

  public getWatchlistSize(): number {
    return this.watchlist.size;
  }

  public forceMarketScan() {
    return this.performMarketScan();
  }

  public getLevel2Data(ticker: string): Level2Data | undefined {
    return this.level2Cache.get(ticker);
  }

  public getPatterns(): PatternData {
    const patterns: PatternData = {};
    
    if (this.userPlan.features.patternRecognition) {
      this.marketMetrics.forEach((metrics, ticker) => {
        if (metrics.candlestickData.length >= 20) {
          const detectedPatterns = this.patternRecognizer.detectAllPatterns(ticker, metrics.candlestickData);
          if (detectedPatterns.length > 0) {
            patterns[ticker] = detectedPatterns.map(p => `${p.name} (${p.confidence.toFixed(0)}%)`);
          }
        }
      });
    }
    
    return patterns;
  }
}

// Singleton instance
let scanner: EnhancedPolygonScanner | null = null;

export const getEnhancedPolygonScanner = (apiKey?: string, userPlan?: UserPlan): EnhancedPolygonScanner => {
  if (!scanner && apiKey) {
    scanner = new EnhancedPolygonScanner(apiKey, userPlan);
  } else if (!scanner) {
    throw new Error('Enhanced Polygon scanner not initialized. Please provide API key.');
  }
  return scanner;
};