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
      .slice(0, 20);
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

    // Load alerts BEFORE setting up scanner callbacks
    const initDB = async () => {
      await cleanupOldAlerts();
      const loadedAlerts = await loadAlertsFromDB();
      if (loadedAlerts.length > 0) {
        setAlerts(loadedAlerts.sort((a, b) => b.timestamp - a.timestamp));
        console.log(`📂 Loaded ${loadedAlerts.length} alerts from database`);
      }
    };
    initDB();

    try {
      console.log('🚀 Initializing Enhanced Polygon Scanner (All Features Enabled)...');
      scanner.current = getEnhancedPolygonScanner(apiKey);
      
      // Set up enhanced callbacks AFTER loading alerts
      scanner.current.onStockUpdate = (update: Partial<Stock>) => {
        if (!update.ticker) return;
        
        const existing = stockDataMap.current.get(update.ticker);
        const updatedStock: Stock = {
          ...existing,
          ...update,
          ticker: update.ticker,
          price: update.price || existing?.price || 0,
          buy_score: update.buy_score || existing?.buy_score || 0,
          relVol: update.relVol || existing?.relVol || 0,
          todaysChangePerc: update.todaysChangePerc || existing?.todaysChangePerc || 0,
          day: update.day || existing?.day || { v: 0, o: 0, h: 0, l: 0, c: 0, vw: 0 },
          float: update.float || existing?.float || 0,
          hasCatalyst: update.hasCatalyst || existing?.hasCatalyst || false,
          volumeSurge: update.volumeSurge || existing?.volumeSurge || false,
          todaysChange: update.todaysChange || existing?.todaysChange || 0,
        };
        
        if (existing) {
          checkAlerts(updatedStock, existing);
        }
        
        stockDataMap.current.set(update.ticker, updatedStock);
        updateDisplayedStocks();
        setLastUpdate(new Date().toLocaleTimeString());
      };

      scanner.current.onLevel2Update = (data: Level2Data) => {
        level2Map.current.set(data.ticker, data);
        updateLevel2Display();
      };

      scanner.current.onAlert = (alert: Alert) => {
        addAlert(alert.severity, alert.ticker, alert.message);
      };

      scanner.current.onConnectionChange = (connected: boolean) => {
        setWsConnected(connected);
        setMarketStatus(connected 
          ? { status: 'CONNECTED', color: 'text-green-400' }
          : { status: 'DISCONNECTED', color: 'text-red-400' }
        );
      };

      scanner.current.onPatternDetected = (ticker: string, pattern: DetectedPattern) => {
        const patterns = patternMap.current.get(ticker) || [];
        patterns.push(pattern);
        patternMap.current.set(ticker, patterns);
        updatePatternsDisplay();
        
        addAlert('info', ticker, `🎯 Pattern detected: ${pattern.name}`);
      };

      scanner.current.onVolumeSurge = (ticker: string, surge: VolumeProfile) => {
        addAlert('warning', ticker, `📈 Volume surge detected: ${surge.relativeVolume.toFixed(1)}x average volume`);
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

    const storedFloat = localStorage.getItem('maxFloat');
    if (storedFloat) setMaxFloat(storedFloat);

    return () => {
      if (scanner.current) {
        scanner.current.cleanup();
        scanner.current = null;
      }
    };
  }, [addAlert, updateDisplayedStocks, updateLevel2Display, updatePatternsDisplay, checkAlerts]);

  // Start scanning - now calls scanner's startScanning method
  const startScanning = useCallback(() => {
    if (scanner.current && !isScanning) {
      setIsScanning(true);
      scanner.current.startScanning(); // Call the scanner's method to actually start
      addAlert('info', 'SYSTEM', '🔍 Enhanced scanning started - all advanced features active');
      setMarketStatus({ status: 'SCANNING', color: 'text-blue-400' });
    }
  }, [isScanning, addAlert]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (isScanning && scanner.current) {
      setIsScanning(false);
      scanner.current.stopScanning(); // Unsubscribe from market data
      addAlert('info', 'SYSTEM', '⏹️ Scanning stopped');
      setMarketStatus({ status: 'STOPPED', color: 'text-yellow-400' });
    }
  }, [isScanning, addAlert]);

  // Delete individual alert function
  const deleteAlert = useCallback(async (alertId: number) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    await deleteAlertFromDB(alertId);
  }, []);

  // Clear functions with database operations
  const clearAlerts = useCallback(async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  }, []);

  const clearPatterns = useCallback(() => {
    patternMap.current.clear();
    setPatterns({});
  }, []);

  const clearStocks = useCallback(() => {
    stockDataMap.current.clear();
    setStocks([]);
    addAlert('info', 'SYSTEM', '🗑️ Watchlist cleared');
  }, [addAlert]);

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

  // Get API call count
  const getApiCalls = useCallback(() => {
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
    deleteAlert,
    clearPatterns,
    clearStocks,
    
    // Utility functions
    testAlert: () => addAlert('info', 'TEST', 'Test alert generated - all advanced features active'),
  };
};

export default useEnhancedPolygonScanner;