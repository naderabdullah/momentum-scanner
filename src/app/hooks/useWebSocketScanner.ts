// src/app/hooks/useWebSocketScanner.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Stock, Alert, Level2Data, Pattern, ScanCriteria } from '../lib/types';
import { loadAlertsFromDB, addAlertToDB, cleanupOldAlerts, clearAllAlertsFromDB } from '../lib/db';
import { parseHumanFloat, formatNumber } from '../lib/utils';
import { getWebSocketService } from '../lib/websocket';

// Pre-defined universe of stocks to monitor
// In production, this would be dynamically fetched based on pre-market movers, volume, etc.
const getStockUniverse = () => {
  const planLevel = process.env.NEXT_PUBLIC_USER_PLAN || 'basic';
  
  // Basic plan - limited to 10 popular stocks
  const basicStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'AMD', 'SOFI', 'PLTR'];
  
  // Starter plan - 25 stocks
  const starterStocks = [
    ...basicStocks,
    'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'PLUG', 'FCEL', 'BLNK', 'CHPT', 'FSR',
    'GME', 'AMC', 'BB', 'NOK', 'SPCE'
  ];
  
  // Developer plan - 50 stocks
  const developerStocks = [
    ...starterStocks,
    'MULN', 'RIDE', 'NKLA', 'GOEV', 'WKHS', 'SNDL', 'TLRY', 'CGC', 'ACB', 'CRON',
    'WISH', 'CLOV', 'ATER', 'PROG', 'CEI', 'GNUS', 'MMAT', 'BBIG', 'XELA', 'SENS',
    'IDEX', 'ZOM', 'EXPR', 'KOSS', 'NAKD'
  ];
  
  // Advanced plan - Full universe
  const advancedStocks = [
    ...developerStocks,
    // Add more stocks for advanced users
    'COIN', 'HOOD', 'DKNG', 'PENN', 'SKLZ', 'OPEN', 'PATH', 'SOFI', 'UPST', 'AFRM',
    'SQ', 'PYPL', 'V', 'MA', 'DIS', 'NFLX', 'ROKU', 'SNAP', 'PINS', 'TWTR'
  ];
  
  switch (planLevel) {
    case 'starter':
      return starterStocks;
    case 'developer':
      return developerStocks;
    case 'advanced':
      return advancedStocks;
    default:
      return basicStocks;
  }
};

const STOCK_UNIVERSE = getStockUniverse();

const useWebSocketScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level2Data, setLevel2Data] = useState<Level2Data[]>([]);
  const [patterns, setPatterns] = useState<Pattern>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ status: 'INIT...', color: 'text-slate-500' });
  const [lastUpdate, setLastUpdate] = useState('Never');
  const [maxFloat, setMaxFloat] = useState('50M');
  
  const wsService = useRef(getWebSocketService());
  const stockDataMap = useRef<Map<string, Stock>>(new Map());
  const level2Map = useRef<Map<string, Level2Data>>(new Map());

  // Calculate buy score based on criteria
  const calculateBuyScore = useCallback((stock: Stock, criteria: ScanCriteria): number => {
    let score = 0;
    
    // Base score from price change and relative volume
    score += Math.min(stock.todaysChangePerc * 2, 30); // Max 30 points from price change
    score += Math.min(stock.relVol * 5, 30); // Max 30 points from relative volume
    
    // Bonus points for meeting criteria
    if (stock.todaysChangePerc >= criteria.minChange) score += 10;
    if (stock.relVol >= criteria.minRelVol) score += 10;
    if (stock.price >= criteria.minPrice && stock.price <= criteria.maxPrice) score += 10;
    if (stock.float > 0 && stock.float <= criteria.maxFloat) score += 10;
    if (stock.hasCatalyst) score += 20;
    
    return Math.min(100, Math.max(0, score));
  }, []);

  const addAlert = useCallback((severity: 'info' | 'warning' | 'critical', ticker: string, message: string) => {
    const newAlert: Alert = { id: Date.now(), severity, ticker, message, timestamp: Date.now() };
    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    addAlertToDB(newAlert);
  }, []);

  const clearAlerts = async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  };

  const clearLevel2Data = () => {
    level2Map.current.clear();
    setLevel2Data([]);
  };

  const clearPatterns = () => setPatterns({});

  // Update stock data when WebSocket sends updates
  const handleStockUpdate = useCallback((update: Partial<Stock>) => {
    if (!update.ticker) return;

    const existing = stockDataMap.current.get(update.ticker) || {
      ticker: update.ticker,
      price: 0,
      todaysChange: 0,
      todaysChangePerc: 0,
      day: { v: 0 },
      relVol: 0,
      float: 0,
      buy_score: 0,
      hasCatalyst: false,
      patterns: {}
    };

    // Merge update with existing data
    const updated: Stock = {
      ...existing,
      ...update,
      day: { v: update.day?.v || existing.day.v }
    };

    // Get ticker details from WebSocket service
    const details = wsService.current.getTickerDetails(update.ticker);
    if (details) {
      updated.float = details.shares_outstanding || 0;
    }

    // Check for news (catalyst)
    const news = wsService.current.getNews(update.ticker);
    updated.hasCatalyst = news.length > 0;

    // Recalculate buy score
    const criteria: ScanCriteria = {
      maxFloat: parseHumanFloat(maxFloat),
      minChange: 10,
      minPrice: 2,
      maxPrice: 20,
      minRelVol: 5
    };
    updated.buy_score = calculateBuyScore(updated, criteria);

    stockDataMap.current.set(update.ticker, updated);

    // Check for alerts
    if (updated.todaysChangePerc > 20 && existing.todaysChangePerc <= 20) {
      addAlert('warning', updated.ticker, `${updated.ticker} surged over 20%!`);
    }
    if (updated.relVol > 10 && existing.relVol <= 10) {
      addAlert('info', updated.ticker, `${updated.ticker} volume spike detected (${updated.relVol.toFixed(1)}x)`);
    }
    if (updated.buy_score >= 90 && existing.buy_score < 90) {
      addAlert('critical', updated.ticker, `${updated.ticker} hit BUY SIGNAL threshold!`);
    }

    // Update displayed stocks
    updateDisplayedStocks();
    setLastUpdate(new Date().toLocaleTimeString());
  }, [maxFloat, calculateBuyScore, addAlert]);

  // Handle Level 2 updates
  const handleLevel2Update = useCallback((data: Level2Data) => {
    level2Map.current.set(data.ticker, data);
    
    // Update displayed Level 2 data
    const topStocks = Array.from(stockDataMap.current.values())
      .sort((a, b) => b.buy_score - a.buy_score)
      .slice(0, 20);
    
    const updatedL2 = topStocks
      .map(stock => level2Map.current.get(stock.ticker))
      .filter((data): data is Level2Data => data !== undefined);
    
    setLevel2Data(updatedL2);
  }, []);

  // Update the displayed stocks list
  const updateDisplayedStocks = useCallback(() => {
    const criteria: ScanCriteria = {
      maxFloat: parseHumanFloat(maxFloat),
      minChange: 10,
      minPrice: 2,
      maxPrice: 20,
      minRelVol: 5
    };

    // Filter and sort stocks
    const filteredStocks = Array.from(stockDataMap.current.values())
      .filter(stock => {
        // Apply soft filters (these contribute to score but don't exclude)
        return stock.price > 0 && stock.day.v > 0;
      })
      .sort((a, b) => b.buy_score - a.buy_score)
      .slice(0, 20);

    setStocks(filteredStocks);
  }, [maxFloat]);

  // Start scanning
  const startScanning = useCallback(() => {
    if (isScanning) return;
    
    setIsScanning(true);
    addAlert('info', 'SYSTEM', 'Real-time scanner started.');
    
    // Subscribe to stock universe
    wsService.current.subscribeToTickers(STOCK_UNIVERSE);
  }, [isScanning, addAlert]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (!isScanning) return;
    
    setIsScanning(false);
    addAlert('info', 'SYSTEM', 'Scanner stopped.');
    
    // Unsubscribe from all tickers
    wsService.current.unsubscribeFromTickers(STOCK_UNIVERSE);
  }, [isScanning, addAlert]);

  // Initialize WebSocket connection
  useEffect(() => {
    const ws = wsService.current;
    
    // Set up callbacks
    ws.onStockUpdate = handleStockUpdate;
    ws.onLevel2Update = handleLevel2Update;
    ws.onAlert = (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 49)]);
      addAlertToDB(alert);
    };
    ws.onConnectionChange = setWsConnected;
    ws.onError = (error) => {
      addAlert('critical', 'SYSTEM', `WebSocket error: ${error}`);
    };

    // Connect to WebSocket
    ws.connect();

    // Load saved data
    const initDB = async () => {
      await cleanupOldAlerts();
      const loadedAlerts = await loadAlertsFromDB();
      setAlerts(loadedAlerts.sort((a, b) => b.timestamp - a.timestamp));
    };
    initDB();

    const storedFloat = localStorage.getItem('maxFloat');
    if (storedFloat) setMaxFloat(storedFloat);

    return () => {
      if (isScanning) {
        ws.unsubscribeFromTickers(STOCK_UNIVERSE);
      }
      ws.disconnect();
    };
  }, []);

  // Save maxFloat preference
  useEffect(() => {
    localStorage.setItem('maxFloat', maxFloat);
    if (isScanning) {
      updateDisplayedStocks();
    }
  }, [maxFloat, isScanning, updateDisplayedStocks]);

  // Update market status
  useEffect(() => {
    const updateMarketStatus = () => {
      const now = new Date();
      const estOffset = -5; // EST
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const estTime = new Date(utc + (3600000 * estOffset));
      const day = estTime.getDay();
      const timeInMinutes = estTime.getHours() * 60 + estTime.getMinutes();
      
      let status = '🔴 CLOSED', color = 'text-red-400';
      if (day > 0 && day < 6) {
        if (timeInMinutes >= 240 && timeInMinutes < 570) {
          status = '🟠 PRE-MARKET';
          color = 'text-amber-400';
        } else if (timeInMinutes >= 570 && timeInMinutes < 960) {
          status = '🟢 OPEN';
          color = 'text-green-400';
        } else if (timeInMinutes >= 960 && timeInMinutes < 1200) {
          status = '🟠 AFTER-HOURS';
          color = 'text-amber-400';
        }
      }
      setMarketStatus({ status, color });
    };

    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    isScanning,
    stocks,
    alerts,
    level2Data,
    patterns,
    apiCalls: 0, // No API calls in WebSocket mode
    marketStatus,
    lastUpdate,
    catalystCount: stocks.filter(s => s.hasCatalyst).length,
    maxFloat,
    setMaxFloat,
    startScanning,
    stopScanning,
    addAlert,
    clearAlerts,
    clearLevel2Data,
    clearPatterns,
    wsConnected,
  };
};

export default useWebSocketScanner;