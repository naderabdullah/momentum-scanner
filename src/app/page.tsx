"use client";

import React from 'react';
import Header from './components/scanner/Header';
import Controls from './components/scanner/Controls';
import StatusBar from './components/scanner/StatusBar';
import Watchlist from './components/scanner/Watchlist';
import InfoPanels from './components/scanner/InfoPanels';
import useScanner from './hooks/useScanner';

export default function ScannerPage() {
  const scanner = useScanner();

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
      />
      <StatusBar
        marketStatus={scanner.marketStatus}
        stockCount={scanner.stocks.length}
        apiCalls={scanner.apiCalls}
        catalystCount={scanner.catalystCount}
        lastUpdate={scanner.lastUpdate}
      />
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <Watchlist stocks={scanner.stocks} isLoading={scanner.isScanning && scanner.stocks.length === 0} />
        <InfoPanels
          alerts={scanner.alerts}
          level2Data={scanner.level2Data}
          patterns={scanner.patterns}
          // --- NEW: Pass clear functions as props ---
          clearAlerts={scanner.clearAlerts}
          clearLevel2Data={scanner.clearLevel2Data}
          clearPatterns={scanner.clearPatterns}
        />
      </main>
    </div>
  );
}
