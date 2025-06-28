// src/app/page.tsx - Enhanced with debug info (hydration-safe)
"use client";

import React, { useState } from 'react';
import Header from './components/scanner/Header';
import StatusBar from './components/scanner/StatusBar';
import Watchlist from './components/scanner/Watchlist';
import InfoPanels from './components/scanner/InfoPanels';
import useEnhancedPolygonScanner from './hooks/useEnhancedPolygonScanner';

export default function EnhancedScannerPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const scanner = useEnhancedPolygonScanner();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Replace 'secret' with your desired password
    if (password === 'abdullahsqueeze') {
      setAuthenticated(true);
    } else {
      alert('Incorrect password');
      setPassword('');
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <form
          onSubmit={handleAuth}
          className="bg-slate-800 p-6 rounded-lg shadow-lg w-80"
        >
          <h2 className="text-white text-xl mb-4 text-center">Enter Password</h2>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 mb-4 rounded bg-slate-700 text-white placeholder-slate-400"
            placeholder="Password"
          />
          <button
            type="submit"
            className="w-full py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
          >
            Submit
          </button>
        </form>
      </div>
    );
  }

  // NEW: Handler for L2 button clicks
  const handleShowLevel2 = (ticker: string) => {
    setSelectedStock(ticker);
  };

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
        {/* Enhanced Real-Time Watchlist */}
        <Watchlist 
          stocks={scanner.stocks} 
          isLoading={scanner.isScanning && scanner.stocks.length === 0 && !scanner.wsConnected}
          clearStocks={scanner.clearStocks}
          onShowLevel2={handleShowLevel2}
        />
        
        {/* Enhanced Info Panels */}
        <InfoPanels
          alerts={scanner.alerts}
          level2Data={scanner.level2Data}
          patterns={scanner.patterns}
          selectedStock={selectedStock}
          clearAlerts={scanner.clearAlerts}
          deleteAlert={scanner.deleteAlert}
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
              <h4 className="text-cyan-400 font-semibold mb-2">📊 Volume Analysis (30%)</h4>
              <ul className="text-slate-300 space-y-1">
                <li>• Relative Volume: 2x+ (was 5x+)</li>
                <li>• Above Average Volume</li>
                <li>• Volume Surge Detection</li>
                <li>• Institutional Flow</li>
              </ul>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-green-400 font-semibold mb-2">💰 Price Action (25%)</h4>
              <ul className="text-slate-300 space-y-1">
                <li>• Daily Change: 3%+ (was 10%+)</li>
                <li>• Price Range: $1-$50 (expanded)</li>
                <li>• Momentum Strength</li>
                <li>• Breakout Patterns</li>
              </ul>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-purple-400 font-semibold mb-2">🏢 Fundamentals (20%)</h4>
              <ul className="text-slate-300 space-y-1">
                <li>• Float: Under 50M (was 20M)</li>
                <li>• Market Liquidity</li>
                <li>• Share Structure</li>
                <li>• Trading Range</li>
              </ul>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <h4 className="text-orange-400 font-semibold mb-2">📰 Catalysts (25%)</h4>
              <ul className="text-slate-300 space-y-1">
                <li>• News Events</li>
                <li>• Pattern Recognition</li>
                <li>• Level 2 Flow</li>
                <li>• Market Sentiment</li>
              </ul>
            </div>
          </div>
          
          <div className="text-center mt-4 pt-4 border-t border-slate-700">
            <p className="text-slate-500 text-xs">
              ⚡ Real-Time Updates Every 1 Second • 
              🎯 Scores Update Live • 
              📊 Volume Alerts Filtered • 
              🔄 Blinking Price Changes
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}