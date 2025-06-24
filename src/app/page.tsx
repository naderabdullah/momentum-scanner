// src/app/page.tsx
"use client";

import React from 'react';
import Header from './components/scanner/Header';
import Controls from './components/scanner/Controls';
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
      
      {/* Enhanced Controls */}
      <Controls
        isScanning={scanner.isScanning}
        startScan={scanner.startScanning}
        stopScan={scanner.stopScanning}
        maxFloat={scanner.maxFloat}
        setMaxFloat={scanner.setMaxFloat}
        testAlert={scanner.testAlert}
        wsConnected={scanner.wsConnected}
        userPlan={scanner.userPlan}
        upgradePlan={scanner.upgradePlan}
      />
      
      {/* Enhanced Status Bar */}
      <StatusBar
        marketStatus={scanner.marketStatus}
        stockCount={scanner.stocks.length}
        apiCalls={scanner.apiCalls}
        catalystCount={scanner.catalystCount}
        lastUpdate={scanner.lastUpdate}
        wsConnected={scanner.wsConnected}
        userPlan={scanner.userPlan}
      />
      
      {/* Main Content Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Enhanced Watchlist */}
        <Watchlist 
          stocks={scanner.stocks} 
          isLoading={scanner.isScanning && scanner.stocks.length === 0 && !scanner.wsConnected}
          userPlan={scanner.userPlan}
        />
        
        {/* Enhanced Info Panels */}
        <InfoPanels
          alerts={scanner.alerts}
          level2Data={scanner.level2Data}
          patterns={scanner.patterns}
          userPlan={scanner.userPlan}
          clearAlerts={scanner.clearAlerts}
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
              <div className="text-slate-300">Target: <span className="text-green-400">&gt;5x</span> average</div>
              <div className="text-xs text-slate-500 mt-1">Higher volume = stronger signal</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-yellow-400 font-bold mb-1">📈 Price Change (25%)</div>
              <div className="text-slate-300">Target: <span className="text-yellow-400">&gt;10%</span> daily move</div>
              <div className="text-xs text-slate-500 mt-1">Momentum strength indicator</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-blue-400 font-bold mb-1">🏢 Float Size (20%)</div>
              <div className="text-slate-300">Target: <span className="text-blue-400">&lt;20M</span> shares</div>
              <div className="text-xs text-slate-500 mt-1">Smaller float = higher volatility</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-purple-400 font-bold mb-1">💰 Price Range (10%)</div>
              <div className="text-slate-300">Target: <span className="text-purple-400">$2-$20</span> per share</div>
              <div className="text-xs text-slate-500 mt-1">Optimal trading range</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-amber-400 font-bold mb-1">📰 News Catalyst (10%)</div>
              <div className="text-slate-300">Recent news <span className="text-amber-400">detected</span></div>
              <div className="text-xs text-slate-500 mt-1">Fundamental driver</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-indigo-400 font-bold mb-1">🎯 Patterns (3%)</div>
              <div className="text-slate-300">Technical <span className="text-indigo-400">formations</span></div>
              <div className="text-xs text-slate-500 mt-1">Bull flags, breakouts, etc.</div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-rose-400 font-bold mb-1">⚡ Volume Surge (2%)</div>
              <div className="text-slate-300">Unusual <span className="text-rose-400">activity</span></div>
              <div className="text-xs text-slate-500 mt-1">Real-time detection</div>
            </div>
          </div>
          
          <div className="text-center mt-6 text-xs text-slate-500">
            <p>🚀 <strong>Scores 90+:</strong> Strong Buy Signal | 🔥 <strong>75-89:</strong> Buy Alert | 📊 <strong>60-74:</strong> Watch List</p>
            <p className="mt-1">Enhanced with real-time Polygon WebSocket feed • Pattern recognition powered by AI • L2 order flow analysis</p>
          </div>
        </div>
      </footer>
    </div>
  );
}