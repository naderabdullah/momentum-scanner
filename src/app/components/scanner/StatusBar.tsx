// src/app/components/scanner/StatusBar.tsx
import React, { useState, useEffect } from 'react';

interface StatusBarProps {
  marketStatus: { status: string; color: string };
  stockCount: number;
  apiCalls: number;
  catalystCount: number;
  lastUpdate: string;
  wsConnected: boolean;
  // Controls props
  isScanning: boolean;
  startScan: () => void;
  stopScan: () => void;
  maxFloat: string;
  setMaxFloat: (value: string) => void;
  testAlert: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  stockCount,
  catalystCount,
  lastUpdate,
  wsConnected,
  isScanning,
  startScan,
  stopScan,
  maxFloat,
  setMaxFloat,
  testAlert
}) => {
  const [tempMaxFloat, setTempMaxFloat] = useState(maxFloat);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [marketSession, setMarketSession] = useState<'pre' | 'regular' | 'after' | 'closed'>('closed');
  const [isClientMounted, setIsClientMounted] = useState(false);

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    setIsClientMounted(true);
    setCurrentTime(new Date());
  }, []);

  // Update current time every second (only on client)
  useEffect(() => {
    if (!isClientMounted) return;
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isClientMounted]);

  // Determine market session (only on client)
  useEffect(() => {
    if (!isClientMounted) return;
    
    const updateMarketSession = () => {
      const now = new Date();
      const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hours = easternTime.getHours();
      const minutes = easternTime.getMinutes();
      const day = easternTime.getDay();
      
      // Weekend check
      if (day === 0 || day === 6) {
        setMarketSession('closed');
        return;
      }
      
      const currentMinutes = hours * 60 + minutes;
      
      if (currentMinutes >= 240 && currentMinutes < 570) {
        setMarketSession('pre');
      } else if (currentMinutes >= 570 && currentMinutes < 960) {
        setMarketSession('regular');
      } else if (currentMinutes >= 960 && currentMinutes < 1200) {
        setMarketSession('after');
      } else {
        setMarketSession('closed');
      }
    };

    updateMarketSession();
    const timer = setInterval(updateMarketSession, 60000);
    return () => clearInterval(timer);
  }, [isClientMounted]);

  const getMarketSessionDisplay = () => {
    switch (marketSession) {
      case 'pre':
        return { text: 'PRE-MARKET', color: 'text-amber-400', icon: '🌅' };
      case 'regular':
        return { text: 'MARKET OPEN', color: 'text-green-400', icon: '🟢' };
      case 'after':
        return { text: 'AFTER-HOURS', color: 'text-blue-400', icon: '🌙' };
      default:
        return { text: 'MARKET CLOSED', color: 'text-slate-400', icon: '🔴' };
    }
  };

  const handleFloatChange = (value: string) => {
    setTempMaxFloat(value);
    setMaxFloat(value);
  };

  const getConnectionStatus = () => {
    if (!wsConnected) return { text: '🔴 DISCONNECTED', color: 'text-red-400' };
    if (isScanning) return { text: '🟢 SCANNING', color: 'text-green-400' };
    return { text: '🟡 CONNECTED', color: 'text-yellow-400' };
  };

  // Don't render until client-side
  if (!isClientMounted || !currentTime) {
    return (
      <div className="sticky top-[73px] z-10 bg-slate-900/95 backdrop-filter backdrop-blur-lg border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-slate-400">Loading status...</div>
        </div>
      </div>
    );
  }

  const connectionStatus = getConnectionStatus();
  const marketDisplay = getMarketSessionDisplay();

  return (
    <div className="sticky top-[73px] z-10 bg-slate-900/95 backdrop-filter backdrop-blur-lg border-b border-slate-800 py-3 pl-4 pr-8">
      <div className="w-full">
        {/* Improved Layout with Better Spacing - Single Row Design */}
        <div className="flex items-center justify-between min-h-[50px]">
          
          {/* Left Section: Scan Controls with Proper Spacing */}
          <div className="flex items-center space-x-8 flex-shrink-0">
            <div className="flex items-center space-x-4 bg-slate-800/30 rounded-lg px-4 py-2 border border-slate-700/50">
              {!isScanning ? (
                <button
                  onClick={startScan}
                  disabled={!wsConnected}
                  className={`px-4 py-2 rounded-lg font-bold transition-all duration-200 whitespace-nowrap ${
                    wsConnected
                      ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white shadow-lg hover:shadow-green-500/25'
                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  🚀 Start  Scan
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-lg font-bold transition-all duration-200 shadow-lg hover:shadow-red-500/25 whitespace-nowrap"
                >
                  ⏹️ Stop Scan
                </button>
              )}

              <div className="w-px h-6 bg-slate-600"></div>

              <span className={`text-sm font-bold whitespace-nowrap ${connectionStatus.color}`}>
                {connectionStatus.text}
              </span>
            </div>
          </div>

          {/* Center Section: Market & Performance Data with Individual Containers */}
          <div className="flex items-center space-x-6 flex-1 justify-center">
            
            {/* Time Display */}
            <div className="flex items-center space-x-2 bg-slate-800/20 rounded-md px-3 py-1.5 border border-slate-700/30">
              <span className="text-xs text-slate-400 whitespace-nowrap">EST:</span>
              <span className="text-sm font-bold text-white font-mono whitespace-nowrap">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour12: false, 
                  timeZone: 'America/New_York' 
                })}
              </span>
            </div>

            {/* Market Status */}
            <div className="flex items-center space-x-2 bg-slate-800/20 rounded-md px-3 py-1.5 border border-slate-700/30">
              <span className={`text-sm font-bold whitespace-nowrap ${marketDisplay.color}`}>
                {marketDisplay.icon} {marketDisplay.text}
              </span>
            </div>

            {/* Stock Count */}
            <div className="flex items-center space-x-2 bg-slate-800/20 rounded-md px-3 py-1.5 border border-slate-700/30">
              <span className="text-xs text-slate-400 whitespace-nowrap">Stocks:</span>
              <span className="text-sm font-bold text-cyan-400 whitespace-nowrap">{stockCount}</span>
            </div>
            
            {/* Catalyst Data */}
            <div className="flex items-center space-x-2 bg-slate-800/20 rounded-md px-3 py-1.5 border border-slate-700/30">
              <span className="text-xs text-slate-400 whitespace-nowrap">Catalysts:</span>
              <span className="text-sm font-bold text-purple-400 whitespace-nowrap">
                {catalystCount > 0 ? 
                  `${catalystCount} (${stockCount > 0 ? Math.round((catalystCount / stockCount) * 100) : 0}%)` 
                  : '0 (0%)'
                }
              </span>
            </div>

            {/* Last Update */}
            <div className="flex items-center space-x-2 bg-slate-800/20 rounded-md px-3 py-1.5 border border-slate-700/30">
              <span className="text-xs text-slate-400 whitespace-nowrap">Updated:</span>
              <span className="text-sm font-mono text-green-400 whitespace-nowrap">{lastUpdate}</span>
            </div>

            {/* Live Indicator */}
            {wsConnected && (
              <div className="flex items-center space-x-2 bg-green-900/20 rounded-md px-3 py-1.5 border border-green-700/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-green-400 whitespace-nowrap">LIVE</span>
              </div>
            )}
          </div>

          {/* Right Section: Controls & Status with Proper Spacing */}
          <div className="flex items-center space-x-6 flex-shrink-0">
            
            {/* Max Float Control */}
            <div className="flex items-center space-x-2 bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/50">
              <label htmlFor="maxFloat" className="text-xs text-slate-400 whitespace-nowrap">
                Max Float:
              </label>
              <select
                id="maxFloat"
                value={tempMaxFloat}
                onChange={(e) => handleFloatChange(e.target.value)}
                className="bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 focus:border-cyan-400 focus:outline-none text-sm whitespace-nowrap"
              >
                <option value="5M">5M</option>
                <option value="10M">10M</option>
                <option value="20M">20M</option>
                <option value="50M">50M</option>
                <option value="100M">100M</option>
                <option value="500M">500M</option>
              </select>
            </div>

            {/* Test Button */}
            <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/50">
              <button
                onClick={testAlert}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded text-sm transition-colors border border-slate-600 hover:border-slate-500 whitespace-nowrap"
                title="Test alert system"
              >
                🧪 Test
              </button>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center space-x-4 bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/50">
              <div className="flex items-center space-x-1.5">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-slate-500 whitespace-nowrap">⚡ WebSocket</span>
              </div>
              
              <div className="w-px h-4 bg-slate-600"></div>
              
              <div className="flex items-center space-x-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  isScanning ? 'bg-green-400' : 'bg-slate-400'
                }`}></div>
                <span className="text-xs text-slate-500 whitespace-nowrap">🔍 Scanner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;