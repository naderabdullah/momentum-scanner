// src/app/hooks/usePolygonScanner.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Stock, Alert, Level2Data, Pattern, ScanCriteria } from '../lib/types';
import { loadAlertsFromDB, addAlertToDB, cleanupOldAlerts, clearAllAlertsFromDB } from '../lib/db';
import { parseHumanFloat } from '../lib/utils';
import { getPolygonScanner, PolygonMarketScanner } from '../lib/polygon-websocket';

const usePolygonScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level2Data, setLevel2Data] = useState<Level2Data[]>([]);
  const [patterns, setPatterns] = useState<Pattern>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ status: 'INIT...', color: 'text-slate-500' });
  const [lastUpdate, setLastUpdate] = useState('Never');
  const [maxFloat, setMaxFloat] = useState('50M');
  const [watchlistSize, setWatchlistSize] = useState(0);
  
  const scanner = useRef<PolygonMarketScanner | null>(null);
  const stockDataMap = useRef<Map<string, Stock>>(new Map());
  const level2Map = useRef<Map<string, Level2Data>>(new Map());

  // Initialize scanner
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
    if (!apiKey) {
      addAlert('critical', 'SYSTEM', 'Polygon API key not configured');
      return;
    }

    try {
      scanner.current = getPolygonScanner(apiKey);
      
      // Set up callbacks
      scanner.current.onStockUpdate = (update: Partial<Stock>) => {
        if (!update.ticker) return;
        
        const existing = stockDataMap.current.get(update.ticker) || {} as Stock;
        const updated = { ...existing, ...update } as Stock;
        
        stockDataMap.current.set(update.ticker, updated);
        updateDisplayedStocks();
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Check for alerts
        checkAlerts(updated, existing);
      };

      scanner.current.onLevel2Update = (data: Level2Data) => {
        level2Map.current.set(data.ticker, data);
        updateLevel2Display();
      };

      scanner.current.onAlert = (alert: Alert) => {
        setAlerts(prev => [alert, ...prev.slice(0, 49)]);
        addAlertToDB(alert);
      };

      scanner.current.onConnectionChange = (connected: boolean) => {
        setWsConnected(connected);
        if (connected) {
          addAlert('info', 'SYSTEM', 'Connected to Polygon WebSocket');
        } else {
          addAlert('warning', 'SYSTEM', 'Disconnected from Polygon WebSocket');
        }
      };

      scanner.current.onError = (error: string) => {
        addAlert('critical', 'SYSTEM', `Scanner error: ${error}`);
      };

      scanner.current.onMarketScan = (stocks: Stock[]) => {
        // Update stock data from market scan
        stocks.forEach(stock => {
          stockDataMap.current.set(stock.ticker, stock);
        });
        updateDisplayedStocks();
        setWatchlistSize(scanner.current?.getWatchlistSize() || 0);
        addAlert('info', 'SCAN', `Market scan complete - tracking ${stocks.length} stocks`);
      };

      // Connect to WebSocket
      scanner.current.connect();
      
    } catch (error) {
      console.error('Failed to initialize scanner:', error);
      addAlert('critical', 'SYSTEM', 'Failed to initialize Polygon scanner');
    }

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
      if (scanner.current) {
        scanner.current.disconnect();
      }
    };
  }, []);

  // Update displayed stocks
  const updateDisplayedStocks = useCallback(() => {
    const sortedStocks = Array.from(stockDataMap.current.values())
      .sort((a, b) => b.buy_score - a.buy_score)
      .slice(0, 20);
    
    setStocks(sortedStocks);
  }, []);

  // Update Level 2 display
  const updateLevel2Display = useCallback(() => {
    const topStocks = stocks.slice(0, 10);
    const l2Data = topStocks
      .map(stock => level2Map.current.get(stock.ticker))
      .filter((data): data is Level2Data => data !== undefined);
    
    setLevel2Data(l2Data);
  }, [stocks]);

  // Check for alerts
  const checkAlerts = useCallback((updated: Stock, existing: Stock) => {
    // Price surge alert
    if (updated.todaysChangePerc > 20 && existing.todaysChangePerc <= 20) {
      addAlert('warning', updated.ticker, `${updated.ticker} surged over 20%!`);
    }
    
    // Volume spike alert
    if (updated.relVol > 10 && existing.relVol <= 10) {
      addAlert('info', updated.ticker, `${updated.ticker} volume spike detected (${updated.relVol.toFixed(1)}x)`);
    }
    
    // Buy signal alert
    if (updated.buy_score >= 90 && existing.buy_score < 90) {
      addAlert('critical', updated.ticker, `${updated.ticker} hit BUY SIGNAL threshold!`);
    }
  }, []);

  // Add alert
  const addAlert = useCallback((severity: 'info' | 'warning' | 'critical', ticker: string, message: string) => {
    const newAlert: Alert = { 
      id: Date.now(), 
      severity, 
      ticker, 
      message, 
      timestamp: Date.now() 
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    addAlertToDB(newAlert);
  }, []);

  // Clear alerts
  const clearAlerts = async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  };

  // Clear Level 2 data
  const clearLevel2Data = () => {
    level2Map.current.clear();
    setLevel2Data([]);
  };

  // Clear patterns
  const clearPatterns = () => setPatterns({});

  // Start scanning
  const startScanning = useCallback(() => {
    if (isScanning || !wsConnected) return;
    
    setIsScanning(true);
    addAlert('info', 'SYSTEM', 'Market scanner started - scanning entire market');
    
    // Force initial scan
    scanner.current?.forceMarketScan();
  }, [isScanning, wsConnected, addAlert]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (!isScanning) return;
    
    setIsScanning(false);
    addAlert('info', 'SYSTEM', 'Market scanner stopped');
  }, [isScanning, addAlert]);

  // Update scanner criteria when maxFloat changes
  useEffect(() => {
    if (scanner.current) {
      const maxFloatValue = parseHumanFloat(maxFloat);
      scanner.current.updateCriteria({ maxFloat: maxFloatValue });
      localStorage.setItem('maxFloat', maxFloat);
    }
  }, [maxFloat]);

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
    apiCalls: 0, // No API call counting needed with WebSocket
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
    watchlistSize,
    forceMarketScan: () => scanner.current?.forceMarketScan(),
  };
};

export default usePolygonScanner;