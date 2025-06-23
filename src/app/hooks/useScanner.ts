"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Stock, Alert, Level2Data, Pattern, ScanCriteria } from '../lib/types';
import { loadAlertsFromDB, addAlertToDB, cleanupOldAlerts, clearAllAlertsFromDB } from '../lib/db';
import { parseHumanFloat } from '../lib/utils';
import { fetchLevel2Data } from '../lib/polygon';

const useScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [level2Data, setLevel2Data] = useState<Level2Data[]>([]);
  const [patterns, setPatterns] = useState<Pattern>({});
  const [apiCalls, setApiCalls] = useState(0);
  const [marketStatus, setMarketStatus] = useState({ status: 'INIT...', color: 'text-slate-500' });
  const [lastUpdate, setLastUpdate] = useState('Never');
  const [maxFloat, setMaxFloat] = useState('50M');
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addAlert = useCallback((severity: 'info' | 'warning' | 'critical', ticker: string, message: string) => {
    const newAlert: Alert = { id: Date.now(), severity, ticker, message, timestamp: Date.now() };
    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    addAlertToDB(newAlert);
  }, []);

  const clearAlerts = async () => {
    setAlerts([]);
    await clearAllAlertsFromDB();
  };
  const clearLevel2Data = () => setLevel2Data([]);
  const clearPatterns = () => setPatterns({});

  const runScan = useCallback(async () => {
    setApiCalls(prev => prev + 1);

    const criteria: ScanCriteria = {
      maxFloat: parseHumanFloat(maxFloat),
      minChange: 10,
      minPrice: 0.01,
      maxPrice: 20,
      minRelVol: 5,
      // --- NEW: Sending market status to the API ---
      marketStatus: marketStatus.status,
    };

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Scan API request failed');
      }

      const data = await response.json();
      
      const stockMap = new Map<string, Stock>();
      stocks.forEach(stock => stockMap.set(stock.ticker, stock));
      (data.stocks || []).forEach((stock: Stock) => stockMap.set(stock.ticker, stock));

      const combinedStocks = Array.from(stockMap.values());
      const sortedStocks = combinedStocks.sort((a, b) => b.buy_score - a.buy_score);
      const finalStocks = sortedStocks.slice(0, 20);
      
      setStocks(finalStocks);

      setLastUpdate(new Date().toLocaleTimeString());

      const newPatterns: Pattern = {};
      finalStocks.forEach((stock: Stock) => {
        if(Object.keys(stock.patterns).length > 0) {
            newPatterns[stock.ticker] = Object.keys(stock.patterns);
        }
      });
      setPatterns(newPatterns);
      
      if(data.stocks.find((s: Stock) => s.buy_score > 90)) {
        addAlert('critical', 'BUY SIGNAL', 'Strong buy signal detected on high-scoring stock!');
      }

    } catch (error) {
      addAlert('critical', 'ERROR', error instanceof Error ? error.message : 'An unknown error occurred during scan.');
      setIsScanning(false);
    }
  }, [addAlert, maxFloat, stocks, marketStatus.status]); // Added marketStatus.status to dependency array

  const startScanning = useCallback(() => {
    if (isScanning) return;
    setIsScanning(true);
    addAlert('info', 'SYSTEM', 'Scanner started.');
    runScan();
    scanIntervalRef.current = setInterval(runScan, 30 * 1000); 
  }, [isScanning, runScan, addAlert]);

  const stopScanning = useCallback(() => {
    if (!isScanning) return;
    setIsScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = null;
    addAlert('info', 'SYSTEM', 'Scanner stopped.');
  }, [isScanning, addAlert]);

  useEffect(() => {
    const initDB = async () => {
      await cleanupOldAlerts();
      const loadedAlerts = await loadAlertsFromDB();
      setAlerts(loadedAlerts.sort((a,b) => b.timestamp - a.timestamp));
    };
    initDB();

    const storedFloat = localStorage.getItem('maxFloat');
    if (storedFloat) setMaxFloat(storedFloat);
  }, []);
  
  useEffect(() => {
     localStorage.setItem('maxFloat', maxFloat);
  }, [maxFloat]);

  useEffect(() => {
    const updateMarketStatus = () => {
       const now = new Date();
       const estOffset = -4;
       const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
       const estTime = new Date(utc + (3600000 * estOffset));
       const day = estTime.getDay(), timeInMinutes = estTime.getHours() * 60 + estTime.getMinutes();
       
       let status = '🔴 CLOSED', color = 'text-red-400';
       if (day > 0 && day < 6) {
           if (timeInMinutes >= 240 && timeInMinutes < 570) { status = '🟠 PRE-MARKET'; color = 'text-amber-400'; }
           else if (timeInMinutes >= 570 && timeInMinutes < 960) { status = '🟢 OPEN'; color = 'text-green-400'; }
           else if (timeInMinutes >= 960 && timeInMinutes < 1200) { status = '🟠 AFTER-HOURS'; color = 'text-amber-400'; }
       }
       setMarketStatus({ status, color });
    }
    updateMarketStatus();
    const statusInterval = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(statusInterval);
  }, []);

  useEffect(() => {
    const updateL2 = async () => {
        if(stocks.length > 0) {
            const top20 = stocks.slice(0,20).map(s => s.ticker);
            const l2 = await fetchLevel2Data(top20);
            setLevel2Data(l2);
        }
    }
    if(isScanning) {
       const l2Interval = setInterval(updateL2, 1000); 
       return () => clearInterval(l2Interval);
    }
  }, [isScanning, stocks]);

  return {
    isScanning,
    stocks,
    alerts,
    level2Data,
    patterns,
    apiCalls,
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
  };
};

export default useScanner;
