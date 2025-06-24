// src/app/hooks/useEnhancedPolygonScanner.ts
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Stock, Alert, Level2Data, PatternData, UserPlan, DetectedPattern, VolumeProfile } from '../lib/types';
import { loadAlertsFromDB, addAlertToDB, cleanupOldAlerts, clearAllAlertsFromDB } from '../lib/db';
import { parseHumanFloat } from '../lib/utils';
import { getEnhancedPolygonScanner, EnhancedPolygonScanner } from '../lib/enhanced-polygon-scanner';

const useEnhancedPolygonScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level2Data, setLevel2Data] = useState<Level2Data[]>([]);
  const [patterns, setPatterns] = useState<PatternData>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ status: 'INIT...', color: 'text-slate-500' });
  const [lastUpdate, setLastUpdate] = useState('Never');
  const [maxFloat, setMaxFloat] = useState('20M'); // Updated default to match user criteria
  const [watchlistSize, setWatchlistSize] = useState(0);
  const [userPlan, setUserPlan] = useState<UserPlan>({
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
  });
  
  const scanner = useRef<EnhancedPolygonScanner | null>(null);
  const stockDataMap = useRef<Map<string, Stock>>(new Map());
  const level2Map = useRef<Map<string, Level2Data>>(new Map());
  const patternMap = useRef<Map<string, DetectedPattern[]>>(new Map());

  // Detect user plan based on environment or settings
  useEffect(() => {
    const detectUserPlan = () => {
      // Check if user has advanced features enabled
      // This could be based on API key tier, environment variables, or user settings
      const isAdvanced = process.env.NEXT_PUBLIC_ADVANCED_FEATURES === 'true' || 
                        process.env.NEXT_PUBLIC_PLAN_LEVEL === 'advanced';
      
      if (isAdvanced) {
        setUserPlan({
          level: 'advanced',
          features: {
            level2Data: true,
            patternRecognition: true,
            volumeSurgeDetection: true,
            orderFlowAnalysis: true,
            realTimeNews: true,
            advancedScreening: true,
            customAlerts: true
          }
        });
      }
    };
    
    detectUserPlan();
  }, []);

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
      console.log('🚀 Initializing Enhanced Polygon Scanner...');
      scanner.current = getEnhancedPolygonScanner(apiKey, userPlan);
      
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
        if (userPlan.features.level2Data) {
          level2Map.current.set(data.ticker, data);
          updateLevel2Display();
        }
      };

      scanner.current.onAlert = (alert: Alert) => {
        setAlerts(prev => [alert, ...prev.slice(0, 99)]); // Keep last 100 alerts
        addAlertToDB(alert);
      };

      scanner.current.onConnectionChange = (connected: boolean) => {
        setWsConnected(connected);
        if (connected) {
          addAlert('info', 'SYSTEM', '🚀 Connected to Enhanced Polygon WebSocket');
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
        if (userPlan.features.patternRecognition) {
          const existing = patternMap.current.get(ticker) || [];
          const updated = [...existing, pattern];
          patternMap.current.set(ticker, updated);
          updatePatternsDisplay();
          
          // High-confidence pattern alert
          if (pattern.confidence > 80) {
            addAlert('info', ticker, `🎯 ${pattern.name} detected (${pattern.confidence.toFixed(0)}% confidence)`);
          }
        }
      };

      scanner.current.onVolumeSurge = (ticker: string, surge: VolumeProfile) => {
        if (userPlan.features.volumeSurgeDetection) {
          addAlert('warning', ticker, `📈 Volume surge! ${surge.relativeVolume.toFixed(1)}x average volume`);
        }
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
        scanner.current.disconnect();
      }
    };
  }, [userPlan]);

  // Update displayed stocks with enhanced buy score sorting
  const updateDisplayedStocks = useCallback(() => {
    const sortedStocks = Array.from(stockDataMap.current.values())
      .filter(stock => stock.buy_score > 0) // Only show stocks with calculated buy scores
      .sort((a, b) => {
        // Primary sort: buy score (descending)
        if (b.buy_score !== a.buy_score) {
          return b.buy_score - a.buy_score;
        }
        // Secondary sort: relative volume (descending)
        if (b.relVol !== a.relVol) {
          return b.relVol - a.relVol;
        }
        // Tertiary sort: price change percentage (descending for positive changes)
        return Math.abs(b.todaysChangePerc) - Math.abs(a.todaysChangePerc);
      })
      .slice(0, 25); // Show top 25 stocks
    
    setStocks(sortedStocks);
  }, []);

  // Update Level 2 display
  const updateLevel2Display = useCallback(() => {
    if (!userPlan.features.level2Data) return;
    
    const topStocks = stocks.slice(0, 10);
    const l2Data = topStocks
      .map(stock => level2Map.current.get(stock.ticker))
      .filter((data): data is Level2Data => data !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    
    setLevel2Data(l2Data);
  }, [stocks, userPlan.features.level2Data]);

  // Update patterns display
  const updatePatternsDisplay = useCallback(() => {
    if (!userPlan.features.patternRecognition) {
      setPatterns({});
      return;
    }
    
    const currentPatterns: PatternData = {};
    
    // Get patterns from scanner
    const scannerPatterns = scanner.current?.getPatterns() || {};
    
    // Convert to display format
    Object.entries(scannerPatterns).forEach(([ticker, patternList]) => {
      if (patternList.length > 0) {
        currentPatterns[ticker] = patternList;
      }
    });
    
    setPatterns(currentPatterns);
  }, [userPlan.features.patternRecognition]);

  // Enhanced alert checking with multiple criteria
  const checkAlerts = useCallback((updated: Stock, existing: Stock) => {
    // Price surge alert - enhanced thresholds
    if (updated.todaysChangePerc > 25 && existing.todaysChangePerc <= 25) {
      addAlert('critical', updated.ticker, `🚀 Major price surge! ${updated.todaysChangePerc.toFixed(1)}% gain`);
    } else if (updated.todaysChangePerc > 15 && existing.todaysChangePerc <= 15) {
      addAlert('warning', updated.ticker, `📈 Price surge detected: ${updated.todaysChangePerc.toFixed(1)}%`);
    }
    
    // Volume spike alert - enhanced detection
    if (updated.relVol > 15 && existing.relVol <= 15) {
      addAlert('critical', updated.ticker, `🔥 MASSIVE volume spike! ${updated.relVol.toFixed(1)}x average`);
    } else if (updated.relVol > 8 && existing.relVol <= 8) {
      addAlert('warning', updated.ticker, `📊 High volume detected: ${updated.relVol.toFixed(1)}x average`);
    }
    
    // Buy signal alerts - enhanced scoring
    if (updated.buy_score >= 95 && existing.buy_score < 95) {
      addAlert('critical', updated.ticker, `🎯 PREMIUM BUY SIGNAL! Score: ${updated.buy_score.toFixed(0)}/100`);
    } else if (updated.buy_score >= 85 && existing.buy_score < 85) {
      addAlert('warning', updated.ticker, `🚀 Strong buy signal: ${updated.buy_score.toFixed(0)}/100`);
    } else if (updated.buy_score >= 75 && existing.buy_score < 75) {
      addAlert('info', updated.ticker, `📊 Buy signal detected: ${updated.buy_score.toFixed(0)}/100`);
    }
    
    // Catalyst alerts
    if (updated.hasCatalyst && !existing.hasCatalyst) {
      addAlert('info', updated.ticker, `📰 News catalyst detected for ${updated.ticker}`);
    }
    
    // Volume surge with pattern combination
    if (updated.volumeSurge && updated.patterns && updated.patterns.length > 0) {
      const patternNames = updated.patterns.map(p => p.name).join(', ');
      addAlert('warning', updated.ticker, `💥 Volume surge + Pattern: ${patternNames}`);
    }
  }, []);

  // Add alert with enhanced categorization
  const addAlert = useCallback((
    severity: 'info' | 'warning' | 'critical', 
    ticker: string, 
    message: string,
    alertType?: 'volume_surge' | 'price_breakout' | 'pattern_detected' | 'buy_signal' | 'news_catalyst' | 'system'
  ) => {
    // Determine alert type with proper typing
    let determinedAlertType: 'volume_surge' | 'price_breakout' | 'pattern_detected' | 'buy_signal' | 'news_catalyst' | 'system' | undefined;
    
    if (alertType) {
      determinedAlertType = alertType;
    } else if (message.includes('BUY SIGNAL')) {
      determinedAlertType = 'buy_signal';
    } else if (message.includes('volume')) {
      determinedAlertType = 'volume_surge';
    } else if (message.includes('Pattern')) {
      determinedAlertType = 'pattern_detected';
    } else if (message.includes('surge')) {
      determinedAlertType = 'price_breakout';
    } else if (message.includes('News')) {
      determinedAlertType = 'news_catalyst';
    } else if (ticker === 'SYSTEM') {
      determinedAlertType = 'system';
    } else {
      determinedAlertType = undefined;
    }

    const newAlert: Alert = { 
      id: Date.now() + Math.random(), // Ensure unique IDs
      severity, 
      ticker, 
      message, 
      timestamp: Date.now(),
      alertType: determinedAlertType
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 99)]);
    addAlertToDB(newAlert);
  }, []);

  // Clear functions
  const clearAlerts = async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  };

  const clearLevel2Data = () => {
    level2Map.current.clear();
    setLevel2Data([]);
  };

  const clearPatterns = () => {
    patternMap.current.clear();
    setPatterns({});
  };

  // Start scanning with enhanced criteria
  const startScanning = useCallback(() => {
    if (isScanning || !wsConnected) return;
    
    setIsScanning(true);
    setMarketStatus({ status: 'SCANNING', color: 'text-blue-400' });
    
    // Update scanner criteria based on user settings
    const floatValue = parseHumanFloat(maxFloat);
    scanner.current?.updateCriteria({
      maxFloat: floatValue,
      minRelativeVolume: 5,     // User specified >5x
      minPriceChangePercent: 10, // User specified >10%
      minPrice: 2,              // User specified $2-$20
      maxPrice: 20,
      requireNews: false        // Don't require news, but boost score if present
    });
    
    addAlert('info', 'SYSTEM', '🚀 Enhanced market scanner started - real-time momentum detection active');
    
    // Force initial scan
    scanner.current?.forceMarketScan();
  }, [isScanning, wsConnected, maxFloat]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (!isScanning) return;
    
    setIsScanning(false);
    setMarketStatus({ status: 'STOPPED', color: 'text-slate-400' });
    addAlert('info', 'SYSTEM', '⏹️ Market scanner stopped');
  }, [isScanning]);

  // Update max float with enhanced validation
  const updateMaxFloat = useCallback((value: string) => {
    setMaxFloat(value);
    localStorage.setItem('maxFloat', value);
    
    if (scanner.current) {
      const floatValue = parseHumanFloat(value);
      scanner.current.updateCriteria({ maxFloat: floatValue });
      addAlert('info', 'SYSTEM', `📊 Max float updated to ${value}`);
    }
  }, []);

  // Get API call count (enhanced tracking)
  const getApiCalls = useCallback(() => {
    // This would be tracked by the enhanced scanner
    return 0; // Placeholder
  }, []);

  // Get catalyst count
  const getCatalystCount = useCallback(() => {
    return stocks.filter(stock => stock.hasCatalyst).length;
  }, [stocks]);

  // Plan upgrade simulation
  const upgradePlan = useCallback(() => {
    setUserPlan({
      level: 'advanced',
      features: {
        level2Data: true,
        patternRecognition: true,
        volumeSurgeDetection: true,
        orderFlowAnalysis: true,
        realTimeNews: true,
        advancedScreening: true,
        customAlerts: true
      }
    });
    
    // Update scanner with new plan
    scanner.current?.updateUserPlan({
      level: 'advanced',
      features: {
        level2Data: true,
        patternRecognition: true,
        volumeSurgeDetection: true,
        orderFlowAnalysis: true,
        realTimeNews: true,
        advancedScreening: true,
        customAlerts: true
      }
    });
    
    addAlert('info', 'SYSTEM', '🎉 Upgraded to Advanced Plan - all features unlocked!');
  }, []);

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
    userPlan,
    
    // Enhanced metrics
    apiCalls: getApiCalls(),
    catalystCount: getCatalystCount(),
    
    // Core functions
    startScanning,
    stopScanning,
    setMaxFloat: updateMaxFloat,
    addAlert,
    clearAlerts,
    clearLevel2Data,
    clearPatterns,
    
    // Advanced functions
    upgradePlan,
    
    // Utility functions
    testAlert: () => addAlert('info', 'TEST', 'Test alert generated'),
  };
};

export default useEnhancedPolygonScanner;