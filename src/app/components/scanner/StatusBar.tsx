// src/app/components/scanner/StatusBar.tsx
import React, { useState, useEffect } from 'react';
import { UserPlan } from '../../lib/types';

interface StatusBarProps {
  marketStatus: { status: string; color: string };
  stockCount: number;
  apiCalls: number;
  catalystCount: number;
  lastUpdate: string;
  wsConnected: boolean;
  userPlan?: UserPlan;
}

const StatusBar: React.FC<StatusBarProps> = ({
  marketStatus,
  stockCount,
  apiCalls,
  catalystCount,
  lastUpdate,
  wsConnected,
  userPlan
}) => {
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
      const preMarketStart = 4 * 60; // 4:00 AM
      const regularStart = 9 * 60 + 30; // 9:30 AM
      const regularEnd = 16 * 60; // 4:00 PM
      const afterEnd = 20 * 60; // 8:00 PM
      
      if (currentMinutes >= preMarketStart && currentMinutes < regularStart) {
        setMarketSession('pre');
      } else if (currentMinutes >= regularStart && currentMinutes < regularEnd) {
        setMarketSession('regular');
      } else if (currentMinutes >= regularEnd && currentMinutes < afterEnd) {
        setMarketSession('after');
      } else {
        setMarketSession('closed');
      }
    };

    updateMarketSession();
    const interval = setInterval(updateMarketSession, 60000); // Update every minute

    return () => clearInterval(interval);
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

  const getConnectionHealth = () => {
    if (!wsConnected) return { text: 'DISCONNECTED', color: 'text-red-400', icon: '❌' };
    return { text: 'STREAMING', color: 'text-green-400', icon: '📡' };
  };

  const formatTime = (date: Date | null) => {
    if (!date || !isClientMounted) return '--:--:--';
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const marketSessionInfo = getMarketSessionDisplay();
  const connectionHealth = getConnectionHealth();

  // Show loading state during hydration
  if (!isClientMounted) {
    return (
      <div className="bg-slate-900/90 backdrop-filter backdrop-blur-lg border-b border-slate-800 py-3 px-4 sticky top-[129px] z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-slate-400">Loading status...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 backdrop-filter backdrop-blur-lg border-b border-slate-800 py-3 px-4 sticky top-[129px] z-10">
      <div className="max-w-7xl mx-auto">
        {/* Main Status Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Side: Market Status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">{marketSessionInfo.icon}</span>
              <div>
                <div className={`text-sm font-bold ${marketSessionInfo.color}`}>
                  {marketSessionInfo.text}
                </div>
                <div className="text-xs text-slate-400">
                  ET: {formatTime(currentTime ? new Date(currentTime.toLocaleString("en-US", {timeZone: "America/New_York"})) : null)}
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-700"></div>

            <div className="flex items-center gap-2">
              <span className="text-lg">{connectionHealth.icon}</span>
              <div>
                <div className={`text-sm font-bold ${connectionHealth.color}`}>
                  {connectionHealth.text}
                </div>
                <div className="text-xs text-slate-400">
                  WebSocket Feed
                </div>
              </div>
            </div>
          </div>

          {/* Center: Key Metrics */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xl font-bold text-cyan-400">{stockCount}</div>
              <div className="text-xs text-slate-400">Stocks Tracked</div>
            </div>

            <div className="text-center">
              <div className="text-xl font-bold text-amber-400">{catalystCount}</div>
              <div className="text-xs text-slate-400">With Catalysts</div>
            </div>

            <div className="text-center">
              <div className="text-xl font-bold text-green-400">
                {stockCount > 0 ? Math.round((catalystCount / stockCount) * 100) : 0}%
              </div>
              <div className="text-xs text-slate-400">Catalyst Rate</div>
            </div>

            {userPlan?.features.level2Data && (
              <div className="text-center">
                <div className="text-xl font-bold text-purple-400">L2</div>
                <div className="text-xs text-slate-400">Order Flow</div>
              </div>
            )}
          </div>

          {/* Right Side: System Info */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-mono text-slate-300">
                Last Update: <span className="text-green-400">{lastUpdate}</span>
              </div>
              <div className="text-xs text-slate-400">
                API Calls: {formatNumber(apiCalls)} | Plan: {userPlan?.level?.toUpperCase() || 'BASIC'}
              </div>
            </div>

            {/* Live Indicator */}
            {wsConnected && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-bold text-green-400">LIVE</span>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Metrics Row (if advanced plan) */}
        {userPlan?.level === 'advanced' && (
          <div className="mt-3 pt-3 border-t border-slate-800/50">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">🎯</span>
                  <span className="text-slate-400">Pattern Recognition:</span>
                  <span className="text-green-400">ACTIVE</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">📊</span>
                  <span className="text-slate-400">Volume Analysis:</span>
                  <span className="text-green-400">ENHANCED</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">📈</span>
                  <span className="text-slate-400">Order Flow:</span>
                  <span className="text-green-400">REAL-TIME</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="px-2 py-1 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded text-purple-300">
                  ADVANCED FEATURES ACTIVE
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Indicators */}
        <div className="mt-3 pt-3 border-t border-slate-800/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-6">
              <span>🚀 Enhanced Momentum Scanner v2.0</span>
              <span>⚡ Real-time WebSocket streaming</span>
              <span>🎯 Advanced buy score algorithm</span>
              {userPlan?.features.patternRecognition && <span>🤖 AI pattern detection</span>}
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span>WebSocket</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  marketSession === 'regular' ? 'bg-green-400' : 
                  marketSession === 'pre' || marketSession === 'after' ? 'bg-amber-400' : 
                  'bg-slate-400'
                }`}></div>
                <span>Market</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stockCount > 0 ? 'bg-green-400' : 'bg-slate-400'}`}></div>
                <span>Scanner</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;