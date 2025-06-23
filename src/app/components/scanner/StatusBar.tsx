// src/app/components/scanner/StatusBar.tsx
import React, { useEffect, useState } from 'react';

interface StatusBarProps {
  marketStatus: { status: string; color: string };
  stockCount: number;
  apiCalls: number;
  catalystCount: number;
  lastUpdate: string;
  wsConnected?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  marketStatus, 
  stockCount, 
  apiCalls, 
  catalystCount, 
  lastUpdate,
  wsConnected 
}) => {
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 p-4 bg-slate-900/50 border-b border-slate-800">
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Market</strong>
        <span className={`text-lg font-bold ${marketStatus.color}`}>{marketStatus.status}</span>
      </div>
      
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Time</strong>
        <span className="text-lg font-bold">{currentTime ?? '--:--:--'}</span>
      </div>
      
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Watchlist</strong>
        <span id="stockCount" className="text-lg font-bold">{stockCount}</span>
      </div>
      
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Connection</strong>
        <span className={`text-lg font-bold ${wsConnected === false ? 'text-red-400' : wsConnected === true ? 'text-green-400' : 'text-slate-400'}`}>
          {wsConnected === undefined ? '⚪ N/A' : wsConnected ? '🟢 LIVE' : '🔴 OFF'}
        </span>
      </div>
      
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Catalysts</strong>
        <span id="catalystCount" className="text-lg font-bold text-amber-400">{catalystCount}</span>
      </div>
      
      <div className="panel text-center p-3 rounded-lg">
        <strong className="block text-slate-400">Last Update</strong>
        <span id="lastUpdate" className="text-lg font-bold">{lastUpdate}</span>
      </div>
    </div>
  );
};

export default StatusBar;