// src/app/page.tsx
"use client";

import React from 'react';
import Header from './components/scanner/Header';
import StatusBar from './components/scanner/StatusBar';
import Watchlist from './components/scanner/Watchlist';
import InfoPanels from './components/scanner/InfoPanels';
import useEnhancedPolygonScanner from './hooks/useEnhancedPolygonScanner';

export default function EnhancedScannerPage() {
  const scanner = useEnhancedPolygonScanner();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-300">
      {/* Enhanced Header */}
      <Header />
      
      {/* Enhanced StatusBar (with integrated Controls) */}
      <StatusBar
        marketStatus={scanner.marketStatus}
        stockCount={scanner.stocks.length}
        apiCalls={scanner.apiCalls}
        catalystCount={scanner.catalystCount}
        lastUpdate={scanner.lastUpdate}
        wsConnected={scanner.wsConnected}
        isScanning={scanner.isScanning}
        startScan={scanner.startScanning}
        stopScan={scanner.stopScanning}
        maxFloat={scanner.maxFloat}
        setMaxFloat={scanner.setMaxFloat}
        testAlert={scanner.testAlert}
      />
      
      {/* Main Content Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Enhanced Watchlist */}
        <Watchlist 
          stocks={scanner.stocks} 
          isLoading={scanner.isScanning && scanner.stocks.length === 0 && !scanner.wsConnected}
          clearStocks={scanner.clearStocks}
        />
        
        {/* Enhanced Info Panels */}
        <InfoPanels
          alerts={scanner.alerts}
          level2Data={scanner.level2Data}
          patterns={scanner.patterns}
          clearAlerts={scanner.clearAlerts}
          deleteAlert={scanner.deleteAlert}
          clearLevel2Data={scanner.clearLevel2Data}
          clearPatterns={scanner.clearPatterns}
        />
      </main>
      
      {/* Footer with Buy Score Criteria */}
      <footer className="border-t border-slate-800 bg-slate-900/50 backdrop-filter backdrop-blur-lg p-4 mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-cyan-400 mb-2">🎯 Enhanced Buy Score Criteria</h3>
            <p className="text-slate-400 text-sm">Real-time scoring based on momentum, volume, and technical analysis</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-green-400 font-bold mb-1">📊 Relative Volume (30%)</div>
              <div className="text-slate-300">Target: <span className="text-green-400">5x+</span></div>
              <div className="text-slate-400 text-xs">Higher volume indicates increased interest</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-blue-400 font-bold mb-1">💹 Price Action (25%)</div>
              <div className="text-slate-300">Target: <span className="text-blue-400">+15%+</span></div>
              <div className="text-slate-400 text-xs">Strong upward momentum preferred</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-purple-400 font-bold mb-1">📰 Catalyst Presence (20%)</div>
              <div className="text-slate-300">Status: <span className="text-purple-400">Required</span></div>
              <div className="text-slate-400 text-xs">News or events driving movement</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-amber-400 font-bold mb-1">🏢 Float Size (25%)</div>
              <div className="text-slate-300">Target: <span className="text-amber-400">&lt;20M</span></div>
              <div className="text-slate-400 text-xs">Lower float = higher volatility potential</div>
            </div>
          </div>
          
          <div className="text-center mt-4 text-xs text-slate-500">
            Scores update in real-time based on current market conditions and technical indicators
          </div>
        </div>
      </footer>
    </div>
  );
}