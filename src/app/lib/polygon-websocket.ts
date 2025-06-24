// src/app/lib/polygon-websocket.ts
import { websocketClient } from "@polygon.io/client-js";
import { Stock, Alert, Level2Data } from './types';

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
}

interface ScanningCriteria {
  minVolume: number;
  minRelativeVolume: number;
  minPriceChangePercent: number;
  minPrice: number;
  maxPrice: number;
  maxFloat: number;
}

export class PolygonMarketScanner {
  private stocksWS: any;
  private restClient: any;
  private _isConnected: boolean = false;
  private marketMetrics: Map<string, MarketMetrics> = new Map();
  private watchlist: Set<string> = new Set();
  private scanningCriteria: ScanningCriteria;
  private lastScanTime: number = 0;
  private scanInterval: number = 30000; // 30 seconds
  
  // Callbacks
  public onStockUpdate?: (stock: Partial<Stock>) => void;
  public onLevel2Update?: (data: Level2Data) => void;
  public onAlert?: (alert: Alert) => void;
  public onConnectionChange?: (connected: boolean) => void;
  public onError?: (error: string) => void;
  public onMarketScan?: (stocks: Stock[]) => void;

  constructor(apiKey: string, criteria?: Partial<ScanningCriteria>) {
    // Initialize Polygon clients
    const polygonClient = websocketClient(apiKey);
    this.stocksWS = polygonClient.stocks();
    
    // Import REST client for scanning
    import("@polygon.io/client-js").then(({ restClient }) => {
      this.restClient = restClient(apiKey);
    });

    // Default scanning criteria
    this.scanningCriteria = {
      minVolume: 1000000,
      minRelativeVolume: 5,
      minPriceChangePercent: 10,
      minPrice: 2,
      maxPrice: 20,
      maxFloat: 50000000, // 50M
      ...criteria
    };

    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.stocksWS.onopen = () => {
      console.log("Polygon WebSocket connected");
      this._isConnected = true;
      this.onConnectionChange?.(true);
      
      // Subscribe to market-wide data for scanning
      this.subscribeToMarketData();
      
      // Start periodic market scanning
      this.startMarketScanning();
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
      }
    };

    this.stocksWS.onclose = (event: CloseEvent) => {
      console.log("Polygon WebSocket disconnected:", event.code, event.reason);
      this._isConnected = false;
      this.onConnectionChange?.(false);
      
      // Automatic reconnection for non-normal closures
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log("Attempting reconnection...");
          this.setupWebSocket();
        }, 5000);
      }
    };

    this.stocksWS.onerror = (error: Event) => {
      console.error("Polygon WebSocket error:", error);
      this.onError?.("WebSocket connection error");
    };
  }

  private handleMessage(msg: any) {
    switch (msg.ev) {
      case "status":
        this.handleStatusMessage(msg);
        break;
      case "T": // Trade
        this.handleTrade(msg);
        break;
      case "Q": // Quote
        this.handleQuote(msg);
        break;
      case "AM": // Minute aggregate
        this.handleAggregate(msg);
        break;
      case "A": // Second aggregate
        this.handleSecondAggregate(msg);
        break;
    }
  }

  private handleStatusMessage(status: any) {
    switch (status.status) {
      case "auth_success":
        console.log("Polygon authentication successful");
        break;
      case "auth_failed":
        this.onError?.("Authentication failed: " + status.message);
        break;
      case "success":
        console.log("Subscription successful:", status.message);
        break;
      case "error":
        console.error("Polygon error:", status.message);
        this.onError?.(status.message);
        break;
    }
  }

  private handleTrade(msg: any) {
    const ticker = msg.sym;
    if (!ticker) return;

    // Update market metrics
    const metrics = this.marketMetrics.get(ticker) || this.createEmptyMetrics(ticker);
    metrics.price = msg.p;
    metrics.volume += msg.s || 0;
    metrics.timestamp = msg.t;
    
    this.marketMetrics.set(ticker, metrics);

    // Check if this stock meets criteria for watchlist
    if (this.evaluateStock(metrics)) {
      this.addToWatchlist(ticker);
    }

    // Send update if stock is in watchlist
    if (this.watchlist.has(ticker)) {
      this.sendStockUpdate(ticker, metrics);
    }
  }

  private handleQuote(msg: any) {
    const ticker = msg.sym;
    if (!ticker || !this.watchlist.has(ticker)) return;

    const level2: Level2Data = {
      ticker: ticker,
      bid_price: msg.bp,
      bid_size: msg.bs || 0,
      ask_price: msg.ap,
      ask_size: msg.as || 0
    };

    this.onLevel2Update?.(level2);
  }

  private handleAggregate(msg: any) {
    const ticker = msg.sym;
    if (!ticker) return;

    // Update market metrics with aggregate data
    const metrics = this.marketMetrics.get(ticker) || this.createEmptyMetrics(ticker);
    
    metrics.price = msg.c;
    metrics.volume = msg.v;
    metrics.dayOpen = msg.op || msg.o;
    metrics.dayHigh = msg.h;
    metrics.dayLow = msg.l;
    metrics.vwap = msg.vw;
    
    // Calculate price change
    if (metrics.dayOpen > 0) {
      metrics.priceChangePercent = ((metrics.price - metrics.dayOpen) / metrics.dayOpen) * 100;
    }
    
    this.marketMetrics.set(ticker, metrics);

    // Evaluate for watchlist
    if (this.evaluateStock(metrics)) {
      this.addToWatchlist(ticker);
    }

    // Send update if in watchlist
    if (this.watchlist.has(ticker)) {
      this.sendStockUpdate(ticker, metrics);
    }
  }

  private handleSecondAggregate(msg: any) {
    // Similar to minute aggregate but more frequent
    this.handleAggregate(msg);
  }

  private createEmptyMetrics(ticker: string): MarketMetrics {
    return {
      ticker,
      price: 0,
      volume: 0,
      volumeRatio: 0,
      priceChangePercent: 0,
      dayOpen: 0,
      dayHigh: 0,
      dayLow: 0,
      vwap: 0,
      timestamp: Date.now()
    };
  }

  private evaluateStock(metrics: MarketMetrics): boolean {
    // Check if stock meets scanning criteria
    return (
      metrics.volume >= this.scanningCriteria.minVolume &&
      Math.abs(metrics.priceChangePercent) >= this.scanningCriteria.minPriceChangePercent &&
      metrics.price >= this.scanningCriteria.minPrice &&
      metrics.price <= this.scanningCriteria.maxPrice &&
      metrics.volumeRatio >= this.scanningCriteria.minRelativeVolume
    );
  }

  private async sendStockUpdate(ticker: string, metrics: MarketMetrics) {
    // Get additional data if available
    const tickerDetails = await this.getTickerDetails(ticker);
    const news = await this.getRecentNews(ticker);
    
    const stock: Partial<Stock> = {
      ticker: ticker,
      price: metrics.price,
      todaysChange: metrics.price - metrics.dayOpen,
      todaysChangePerc: metrics.priceChangePercent,
      day: { v: metrics.volume },
      relVol: metrics.volumeRatio,
      float: tickerDetails?.shares_outstanding || 0,
      hasCatalyst: news.length > 0,
      buy_score: this.calculateBuyScore(metrics, tickerDetails, news.length > 0)
    };

    this.onStockUpdate?.(stock);
  }

  private calculateBuyScore(metrics: MarketMetrics, details: any, hasCatalyst: boolean): number {
    let score = 0;
    
    // Price change component (max 30 points)
    score += Math.min(Math.abs(metrics.priceChangePercent) * 2, 30);
    
    // Relative volume component (max 30 points)
    score += Math.min(metrics.volumeRatio * 5, 30);
    
    // Bonus points
    if (Math.abs(metrics.priceChangePercent) >= this.scanningCriteria.minPriceChangePercent) score += 10;
    if (metrics.volumeRatio >= this.scanningCriteria.minRelativeVolume) score += 10;
    if (metrics.price >= this.scanningCriteria.minPrice && metrics.price <= this.scanningCriteria.maxPrice) score += 10;
    if (details?.shares_outstanding > 0 && details.shares_outstanding <= this.scanningCriteria.maxFloat) score += 10;
    if (hasCatalyst) score += 20;
    
    return Math.min(100, Math.max(0, score));
  }

  private addToWatchlist(ticker: string) {
    if (!this.watchlist.has(ticker)) {
      this.watchlist.add(ticker);
      
      // Subscribe to detailed data for this ticker
      this.stocksWS.send({
        action: "subscribe",
        params: `T.${ticker},Q.${ticker},A.${ticker}`
      });
      
      this.onAlert?.({
        id: Date.now(),
        severity: 'info',
        ticker: ticker,
        message: `${ticker} added to watchlist - meets scanning criteria`,
        timestamp: Date.now()
      });
    }
  }

  private removeFromWatchlist(ticker: string) {
    if (this.watchlist.has(ticker)) {
      this.watchlist.delete(ticker);
      
      // Unsubscribe from detailed data
      this.stocksWS.send({
        action: "unsubscribe",
        params: `T.${ticker},Q.${ticker},A.${ticker}`
      });
    }
  }

  private subscribeToMarketData() {
    // Subscribe to market-wide minute aggregates for scanning
    this.stocksWS.send({
      action: "subscribe",
      params: "AM.*" // All minute aggregates
    });
    
    // For more granular scanning, could also subscribe to:
    // "T.*" for all trades (very high volume)
    // "A.*" for all second aggregates
  }

  private async startMarketScanning() {
    // Initial scan
    await this.scanMarket();
    
    // Periodic scanning
    setInterval(async () => {
      if (this._isConnected) {
        await this.scanMarket();
      }
    }, this.scanInterval);
  }

  private async scanMarket() {
    const now = Date.now();
    if (now - this.lastScanTime < this.scanInterval - 1000) return;
    
    this.lastScanTime = now;
    console.log("Running market scan...");
    
    try {
      // Get top movers using REST API
      if (this.restClient) {
        const gainers = await this.restClient.stocks.snapshotGainersLosers("gainers");
        const losers = await this.restClient.stocks.snapshotGainersLosers("losers");
        
        // Process top movers
        [...gainers.tickers, ...losers.tickers].forEach(ticker => {
          this.evaluateTickerForWatchlist(ticker);
        });
      }
      
      // Also check stocks from WebSocket data
      const topStocks = Array.from(this.marketMetrics.values())
        .filter(metrics => this.evaluateStock(metrics))
        .sort((a, b) => b.volumeRatio - a.volumeRatio)
        .slice(0, 50);
      
      topStocks.forEach(metrics => {
        this.addToWatchlist(metrics.ticker);
      });
      
      // Clean up old stocks from watchlist
      this.cleanupWatchlist();
      
      // Send scan results
      const watchlistStocks = await this.getWatchlistStocks();
      this.onMarketScan?.(watchlistStocks);
      
    } catch (error) {
      console.error("Market scan error:", error);
    }
  }

  private async evaluateTickerForWatchlist(tickerData: any) {
    const ticker = tickerData.ticker || tickerData.T;
    if (!ticker) return;
    
    // Create metrics from snapshot data
    const metrics: MarketMetrics = {
      ticker: ticker,
      price: tickerData.lastsale || tickerData.lastQuote?.P || 0,
      volume: tickerData.volume || 0,
      volumeRatio: 0, // Will be calculated if we have previous day data
      priceChangePercent: tickerData.todaysChangePerc || 0,
      dayOpen: tickerData.open || 0,
      dayHigh: tickerData.high || 0,
      dayLow: tickerData.low || 0,
      vwap: tickerData.vwap || 0,
      timestamp: Date.now()
    };
    
    // Calculate relative volume if we have previous day data
    if (tickerData.prevDay?.v && tickerData.volume) {
      metrics.volumeRatio = tickerData.volume / tickerData.prevDay.v;
    }
    
    this.marketMetrics.set(ticker, metrics);
    
    if (this.evaluateStock(metrics)) {
      this.addToWatchlist(ticker);
    }
  }

  private cleanupWatchlist() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    this.watchlist.forEach(ticker => {
      const metrics = this.marketMetrics.get(ticker);
      
      // Remove if no recent data or no longer meets criteria
      if (!metrics || 
          now - metrics.timestamp > staleThreshold || 
          !this.evaluateStock(metrics)) {
        this.removeFromWatchlist(ticker);
      }
    });
  }

  private async getWatchlistStocks(): Promise<Stock[]> {
    const stocks: Stock[] = [];
    
    for (const ticker of this.watchlist) {
      const metrics = this.marketMetrics.get(ticker);
      if (!metrics) continue;
      
      const details = await this.getTickerDetails(ticker);
      const news = await this.getRecentNews(ticker);
      
      stocks.push({
        ticker: ticker,
        price: metrics.price,
        todaysChange: metrics.price - metrics.dayOpen,
        todaysChangePerc: metrics.priceChangePercent,
        day: { v: metrics.volume },
        relVol: metrics.volumeRatio,
        float: details?.shares_outstanding || 0,
        hasCatalyst: news.length > 0,
        buy_score: this.calculateBuyScore(metrics, details, news.length > 0),
        patterns: {}
      });
    }
    
    return stocks.sort((a, b) => b.buy_score - a.buy_score);
  }

  // Cache for ticker details and news
  private tickerDetailsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private newsCache: Map<string, { data: any[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private async getTickerDetails(ticker: string): Promise<any> {
    const cached = this.tickerDetailsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      if (this.restClient) {
        const details = await this.restClient.reference.tickerDetails(ticker);
        this.tickerDetailsCache.set(ticker, { data: details, timestamp: Date.now() });
        return details;
      }
    } catch (error) {
      console.error(`Failed to get details for ${ticker}:`, error);
    }
    
    return null;
  }

  private async getRecentNews(ticker: string): Promise<any[]> {
    const cached = this.newsCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    try {
      if (this.restClient) {
        const news = await this.restClient.reference.tickerNews({ ticker, limit: 5 });
        this.newsCache.set(ticker, { data: news.results || [], timestamp: Date.now() });
        return news.results || [];
      }
    } catch (error) {
      console.error(`Failed to get news for ${ticker}:`, error);
    }
    
    return [];
  }

  // Public methods
  public connect() {
    if (!this.isConnected) {
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
    // Re-evaluate all stocks with new criteria
    this.cleanupWatchlist();
  }

  public getWatchlistSize(): number {
    return this.watchlist.size;
  }

  public forceMarketScan() {
    return this.scanMarket();
  }
}

// Singleton instance
let scanner: PolygonMarketScanner | null = null;

export const getPolygonScanner = (apiKey?: string): PolygonMarketScanner => {
  if (!scanner && apiKey) {
    scanner = new PolygonMarketScanner(apiKey);
  } else if (!scanner) {
    throw new Error('Polygon scanner not initialized. Please provide API key.');
  }
  return scanner;
};