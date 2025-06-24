// src/app/hooks/useEnhancedPolygonScanner.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Stock, Alert, Level2Data, DetectedPattern, VolumeProfile } from '../lib/types';
import { EnhancedPolygonScanner, getEnhancedPolygonScanner } from '../lib/enhanced-polygon-scanner';
import { addAlertToDB, loadAlertsFromDB, clearAllAlertsFromDB, deleteAlertFromDB, cleanupOldAlerts } from '../lib/db';

// Utility functions
const parseHumanFloat = (value: string): number => {
  const cleanValue = value.replace(/[^\d.]/g, '');
  const numValue = parseFloat(cleanValue);
  
  if (value.toLowerCase().includes('m')) {
    return numValue * 1000000;
  } else if (value.toLowerCase().includes('k')) {
    return numValue * 1000;
  } else if (value.toLowerCase().includes('b')) {
    return numValue * 1000000000;
  }
  
  return numValue || 0;
};

interface MarketStatus {
  status: string;
  color: string;
}

const useEnhancedPolygonScanner = () => {
  // Core state
  const [isScanning, setIsScanning] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level2Data, setLevel2Data] = useState<Level2Data[]>([]);
  const [patterns, setPatterns] = useState<{ [ticker: string]: string[] }>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>({ status: 'DISCONNECTED', color: 'text-gray-400' });
  const [lastUpdate, setLastUpdate] = useState<string>('Never');
  const [maxFloat, setMaxFloat] = useState<string>('20M');
  const [watchlistSize, setWatchlistSize] = useState(0);

  // Scanner instance
  const scanner = useRef<EnhancedPolygonScanner | null>(null);
  const stockDataMap = useRef<Map<string, Stock>>(new Map());
  const level2Map = useRef<Map<string, Level2Data>>(new Map());
  const patternMap = useRef<Map<string, DetectedPattern[]>>(new Map());

  // Helper functions
  const addAlert = useCallback((severity: Alert['severity'], ticker: string, message: string) => {
    const alert: Alert = {
      id: Date.now() + Math.random(),
      severity,
      ticker,
      message,
      timestamp: Date.now()
    };
    
    setAlerts(prev => [alert, ...prev].slice(0, 100));
    addAlertToDB(alert);
  }, []);

  const updateDisplayedStocks = useCallback(() => {
    const stockArray = Array.from(stockDataMap.current.values())
      .sort((a, b) => b.buy_score - a.buy_score)
      .slice(0, 50);
    setStocks(stockArray);
  }, []);

  const updateLevel2Display = useCallback(() => {
    const level2Array = Array.from(level2Map.current.values());
    setLevel2Data(level2Array);
  }, []);

  const updatePatternsDisplay = useCallback(() => {
    const patternsObj: { [ticker: string]: string[] } = {};
    patternMap.current.forEach((patterns, ticker) => {
      patternsObj[ticker] = patterns.map(pattern => pattern.name);
    });
    setPatterns(patternsObj);
  }, []);

  const checkAlerts = useCallback((updated: Stock, existing: Stock) => {
    // High buy score alert
    if (updated.buy_score > 80 && existing.buy_score <= 80) {
      addAlert('critical', updated.ticker, `🎯 HIGH BUY SCORE: ${updated.buy_score.toFixed(0)}`);
    }
    
    // Volume surge alert
    if (updated.relVol > 10 && existing.relVol <= 10) {
      addAlert('warning', updated.ticker, `📈 VOLUME SURGE: ${updated.relVol.toFixed(1)}x average`);
    }
    
    // Price breakout alert
    if (Math.abs(updated.todaysChangePerc) > 20 && Math.abs(existing.todaysChangePerc) <= 20) {
      addAlert('warning', updated.ticker, `🚀 PRICE BREAKOUT: ${updated.todaysChangePerc > 0 ? '+' : ''}${updated.todaysChangePerc.toFixed(1)}%`);
    }
  }, [addAlert]);

  // Initialize scanner (client-side only)
  useEffect(() => {
    // Prevent server-side execution
    if (typeof window === 'undefined') return;
    
    const apiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY;
    if (!apiKey) {
      addAlert('critical', 'SYSTEM', '❌ Polygon API key not configured in environment variables');
      return;
    }

    if (!apiKey.startsWith('')) {
      addAlert('warning', 'SYSTEM', '⚠️ Please ensure your Polygon API key is valid');
    }

    try {
      console.log('🚀 Initializing Enhanced Polygon Scanner (All Features Enabled)...');
      scanner.current = getEnhancedPolygonScanner(apiKey);
      
      // Set up enhanced callbacks
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
        setAlerts(prev => [alert, ...prev.slice(0, 99)]); // Keep last 100 alerts
        addAlertToDB(alert);
      };

      scanner.current.onConnectionChange = (connected: boolean) => {
        setWsConnected(connected);
        if (connected) {
          addAlert('info', 'SYSTEM', '🚀 Connected to Enhanced Polygon WebSocket - All Features Active');
          setMarketStatus({ status: 'CONNECTED', color: 'text-green-400' });
        } else {
          addAlert('warning', 'SYSTEM', '⚠️ Disconnected from Polygon WebSocket');
          setMarketStatus({ status: 'DISCONNECTED', color: 'text-red-400' });
        }
      };

      scanner.current.onError = (error: string) => {
        addAlert('critical', 'SYSTEM', `Scanner error: ${error}`);
        setMarketStatus({ status: 'ERROR', color: 'text-red-400' });
      };

      scanner.current.onMarketScan = (stocks: Stock[]) => {
        // Update stock data from market scan
        stocks.forEach(stock => {
          stockDataMap.current.set(stock.ticker, stock);
        });
        updateDisplayedStocks();
        setWatchlistSize(scanner.current?.getWatchlistSize() || 0);
        addAlert('info', 'SCAN', `📊 Market scan complete - tracking ${stocks.length} stocks`);
      };

      scanner.current.onPatternDetected = (ticker: string, pattern: DetectedPattern) => {
        const existing = patternMap.current.get(ticker) || [];
        const updated = [...existing, pattern];
        patternMap.current.set(ticker, updated);
        updatePatternsDisplay();
        
        // High-confidence pattern alert
        if (pattern.confidence > 80) {
          addAlert('info', ticker, `🎯 ${pattern.name} detected (${pattern.confidence.toFixed(0)}% confidence)`);
        }
      };

      scanner.current.onVolumeSurge = (ticker: string, surge: VolumeProfile) => {
        addAlert('warning', ticker, `📈 Volume surge! ${surge.relativeVolume.toFixed(1)}x average volume`);
      };

      // Connect to WebSocket
      scanner.current.connect();
      
    } catch (error) {
      console.error('Failed to initialize enhanced scanner:', error);
      
      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          addAlert('critical', 'SYSTEM', '🔑 Invalid or missing Polygon API key - check your .env.local file');
        } else {
          addAlert('critical', 'SYSTEM', `🚨 Scanner initialization failed: ${error.message}`);
        }
      } else {
        addAlert('critical', 'SYSTEM', '🚨 Failed to initialize Enhanced Polygon scanner');
      }
      
      return;
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
        scanner.current.cleanup();
        scanner.current = null;
      }
    };
  }, [addAlert, updateDisplayedStocks, updateLevel2Display, updatePatternsDisplay, checkAlerts]);

  // Start scanning
  const startScanning = useCallback(() => {
    if (scanner.current && !isScanning) {
      setIsScanning(true);
      addAlert('info', 'SYSTEM', '🔍 Enhanced scanning started - all advanced features active');
      setMarketStatus({ status: 'SCANNING', color: 'text-blue-400' });
    }
  }, [isScanning, addAlert]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (isScanning) {
      setIsScanning(false);
      addAlert('info', 'SYSTEM', '⏹️ Scanning stopped');
      setMarketStatus({ status: 'STOPPED', color: 'text-yellow-400' });
    }
  }, [isScanning, addAlert]);

  // NEW: Delete individual alert function
  const deleteAlert = useCallback(async (alertId: number) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    await deleteAlertFromDB(alertId);
  }, []);

  // Updated: Clear functions with database operations
  const clearAlerts = useCallback(async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  }, []);

  const clearLevel2Data = useCallback(() => {
    level2Map.current.clear();
    setLevel2Data([]);
  }, []);

  const clearPatterns = useCallback(() => {
    patternMap.current.clear();
    setPatterns({});
  }, []);

  // Update max float
  const updateMaxFloat = useCallback((value: string) => {
    setMaxFloat(value);
    const floatValue = parseHumanFloat(value);
    localStorage.setItem('maxFloat', value);
    
    if (scanner.current) {
      scanner.current.updateCriteria({ maxFloat: floatValue });
      addAlert('info', 'SYSTEM', `📊 Max float updated to ${value}`);
    }
  }, [addAlert]);

  // Get API call count (enhanced tracking)
  const getApiCalls = useCallback(() => {
    // This would be tracked by the enhanced scanner
    return 0; // Placeholder
  }, []);

  // Get catalyst count
  const getCatalystCount = useCallback(() => {
    return stocks.filter(stock => stock.hasCatalyst).length;
  }, [stocks]);

  return {
    // Core state
    isScanning,
    stocks,
    alerts,
    level2Data,
    patterns,
    wsConnected,
    marketStatus,
    lastUpdate,
    maxFloat,
    watchlistSize,
    
    // Enhanced metrics
    apiCalls: getApiCalls(),
    catalystCount: getCatalystCount(),
    
    // Core functions
    startScanning,
    stopScanning,
    setMaxFloat: updateMaxFloat,
    addAlert,
    clearAlerts,
    deleteAlert, // NEW: Individual alert deletion
    clearLevel2Data,
    clearPatterns,
    
    // Utility functions
    testAlert: () => addAlert('info', 'TEST', 'Test alert generated - all advanced features active'),
  };
};

export default useEnhancedPolygonScanner;