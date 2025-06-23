// src/app/lib/websocket.ts
import { Stock, Alert, Level2Data } from './types';

export interface WebSocketMessage {
  ev: string; // Event type
  sym?: string; // Symbol/Ticker
  p?: number; // Price
  s?: number; // Size
  v?: number; // Volume
  av?: number; // Aggregate volume
  op?: number; // Open price
  vw?: number; // Volume weighted average
  o?: number; // Open
  c?: number; // Close
  h?: number; // High
  l?: number; // Low
  a?: number; // Ask
  b?: number; // Bid
  as?: number; // Ask size
  bs?: number; // Bid size
  t?: number; // Timestamp
  n?: number; // Trade ID
  x?: number; // Exchange ID
}

export interface TickerDetails {
  ticker: string;
  shares_outstanding?: number;
  market_cap?: number;
  name?: string;
  description?: string;
  sic_code?: string;
  primary_exchange?: string;
}

export interface NewsItem {
  id: string;
  publisher: { name: string };
  title: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
}

class PolygonWebSocketService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private reconnectInterval: number = 5000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private isIntentionallyClosed: boolean = false;
  private subscribedTickers: Set<string> = new Set();
  private tickerDetailsCache: Map<string, TickerDetails> = new Map();
  private newsCache: Map<string, NewsItem[]> = new Map();
  private dailyBarsCache: Map<string, any> = new Map();
  
  // Callbacks
  public onStockUpdate?: (stock: Partial<Stock>) => void;
  public onLevel2Update?: (data: Level2Data) => void;
  public onAlert?: (alert: Alert) => void;
  public onConnectionChange?: (connected: boolean) => void;
  public onError?: (error: string) => void;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    const wsUrl = `wss://socket.polygon.io/stocks`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.onConnectionChange?.(true);
        
        // Authenticate
        this.send({
          action: 'auth',
          params: this.apiKey
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const messages = JSON.parse(event.data);
          if (Array.isArray(messages)) {
            messages.forEach(msg => this.handleMessage(msg));
          } else {
            this.handleMessage(messages);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError?.('WebSocket connection error');
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.onConnectionChange?.(false);
        
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting in ${this.reconnectInterval}ms... (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.onError?.('Failed to create WebSocket connection');
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, queuing message');
    }
  }

  private handleMessage(msg: WebSocketMessage) {
    switch (msg.ev) {
      case 'status':
        if ((msg as any).status === 'auth_success') {
          console.log('Authentication successful');
          // Resubscribe to all tickers
          if (this.subscribedTickers.size > 0) {
            this.subscribeToTickers(Array.from(this.subscribedTickers));
          }
        } else if ((msg as any).status === 'auth_failed') {
          this.onError?.('Authentication failed');
        }
        break;

      case 'T': // Trade
        this.handleTrade(msg);
        break;

      case 'Q': // Quote
        this.handleQuote(msg);
        break;

      case 'A': // Aggregate (minute bar)
      case 'AM': // Aggregate minute
        this.handleAggregate(msg);
        break;

      case 'error':
        console.error('WebSocket error message:', msg);
        this.onError?.((msg as any).message || 'Unknown error');
        break;
    }
  }

  private handleTrade(msg: WebSocketMessage) {
    if (!msg.sym || !msg.p) return;

    const stock: Partial<Stock> = {
      ticker: msg.sym,
      price: msg.p,
      day: { v: msg.v || 0 }
    };

    // Calculate relative volume if we have historical data
    const dailyBar = this.dailyBarsCache.get(msg.sym);
    if (dailyBar && dailyBar.prevVolume > 0 && msg.v) {
      stock.relVol = msg.v / dailyBar.prevVolume;
    }

    this.onStockUpdate?.(stock);
  }

  private handleQuote(msg: WebSocketMessage) {
    if (!msg.sym || msg.b === undefined || msg.a === undefined) return;

    const level2: Level2Data = {
      ticker: msg.sym,
      bid_price: msg.b,
      bid_size: msg.bs || 0,
      ask_price: msg.a,
      ask_size: msg.as || 0
    };

    this.onLevel2Update?.(level2);
  }

  private handleAggregate(msg: WebSocketMessage) {
    if (!msg.sym) return;

    const dailyBar = this.dailyBarsCache.get(msg.sym) || {};
    
    // Update daily stats
    if (msg.o !== undefined) dailyBar.open = msg.o;
    if (msg.h !== undefined) dailyBar.high = msg.h;
    if (msg.l !== undefined) dailyBar.low = msg.l;
    if (msg.c !== undefined) dailyBar.close = msg.c;
    if (msg.v !== undefined) dailyBar.volume = msg.v;
    if (msg.vw !== undefined) dailyBar.vwap = msg.vw;
    
    this.dailyBarsCache.set(msg.sym, dailyBar);

    // Calculate change percentage if we have open price
    if (dailyBar.open && msg.c) {
      const changePerc = ((msg.c - dailyBar.open) / dailyBar.open) * 100;
      const change = msg.c - dailyBar.open;

      const stock: Partial<Stock> = {
        ticker: msg.sym,
        price: msg.c,
        todaysChange: change,
        todaysChangePerc: changePerc,
        day: { v: msg.v || 0 }
      };

      // Calculate relative volume if we have previous day data
      if (dailyBar.prevVolume > 0 && msg.v) {
        stock.relVol = msg.v / dailyBar.prevVolume;
      }

      this.onStockUpdate?.(stock);
    }
  }

  subscribeToTickers(tickers: string[]) {
    if (!tickers.length) return;

    tickers.forEach(ticker => this.subscribedTickers.add(ticker));

    // Subscribe to trades, quotes, and minute aggregates
    const tradeSubs = tickers.map(t => `T.${t}`);
    const quoteSubs = tickers.map(t => `Q.${t}`);
    const aggSubs = tickers.map(t => `AM.${t}`);

    this.send({
      action: 'subscribe',
      params: [...tradeSubs, ...quoteSubs, ...aggSubs].join(',')
    });

    // For each new ticker, we need to fetch initial data
    // Since we're WebSocket-only, we'll need to wait for the first updates
    tickers.forEach(ticker => {
      if (!this.tickerDetailsCache.has(ticker)) {
        // In a real implementation, you might want to fetch this data
        // from a separate service or cache
        this.requestTickerDetails(ticker);
      }
    });
  }

  unsubscribeFromTickers(tickers: string[]) {
    if (!tickers.length) return;

    tickers.forEach(ticker => this.subscribedTickers.delete(ticker));

    const tradeSubs = tickers.map(t => `T.${t}`);
    const quoteSubs = tickers.map(t => `Q.${t}`);
    const aggSubs = tickers.map(t => `AM.${t}`);

    this.send({
      action: 'unsubscribe',
      params: [...tradeSubs, ...quoteSubs, ...aggSubs].join(',')
    });
  }

  private requestTickerDetails(ticker: string) {
    // In a WebSocket-only implementation, we'd need to either:
    // 1. Have a separate WebSocket channel for reference data
    // 2. Use a different service for static data
    // 3. Pre-load this data when the app starts
    // For now, we'll simulate with default values
    
    const mockDetails: TickerDetails = {
      ticker,
      shares_outstanding: 50000000, // 50M default
      market_cap: 0,
      name: ticker,
      primary_exchange: 'NASDAQ'
    };

    this.tickerDetailsCache.set(ticker, mockDetails);
  }

  getTickerDetails(ticker: string): TickerDetails | undefined {
    return this.tickerDetailsCache.get(ticker);
  }

  getNews(ticker: string): NewsItem[] {
    return this.newsCache.get(ticker) || [];
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedTickers.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsService: PolygonWebSocketService | null = null;

export const getWebSocketService = (): PolygonWebSocketService => {
  if (!wsService) {
    const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY || '';
    if (!apiKey) {
      throw new Error('Polygon API key not configured');
    }
    wsService = new PolygonWebSocketService(apiKey);
  }
  return wsService;
};