// src/app/page.tsx
"use client";

import React from 'react';
import Header from './components/scanner/Header';
import Controls from './components/scanner/Controls';
import StatusBar from './components/scanner/StatusBar';
import Watchlist from './components/scanner/Watchlist';
import InfoPanels from './components/scanner/InfoPanels';
import useWebSocketScanner from './hooks/useWebSocketScanner';

export default function ScannerPage() {
  const scanner = useWebSocketScanner();

  return (
    <div className="text-slate-300">
      <Header />
      <Controls
        isScanning={scanner.isScanning}
        startScan={scanner.startScanning}
        stopScan={scanner.stopScanning}
        maxFloat={scanner.maxFloat}
        setMaxFloat={scanner.setMaxFloat}
        testAlert={scanner.addAlert}
        wsConnected={scanner.wsConnected}
      />
      <StatusBar
        marketStatus={scanner.marketStatus}
        stockCount={scanner.stocks.length}
        apiCalls={scanner.apiCalls}
        catalystCount={scanner.catalystCount}
        lastUpdate={scanner.lastUpdate}
        wsConnected={scanner.wsConnected}
      />
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <Watchlist 
          stocks={scanner.stocks} 
          isLoading={scanner.isScanning && scanner.stocks.length === 0 && !scanner.wsConnected} 
        />
        <InfoPanels
          alerts={scanner.alerts}
          level2Data={scanner.level2Data}
          patterns={scanner.patterns}
          clearAlerts={scanner.clearAlerts}
          clearLevel2Data={scanner.clearLevel2Data}
          clearPatterns={scanner.clearPatterns}
        />
      </main>
    </div>
  );
}