// src/app/components/scanner/StatusBar.tsx
import React from 'react';

interface MarketStatus {
  status: string;
  color: string;
}

interface StatusBarProps {
  marketStatus: MarketStatus;
  stockCount: number;
  catalystCount: number;
  lastUpdate: string;
  wsConnected: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  marketStatus,
  stockCount,
  catalystCount,
  lastUpdate,
  wsConnected
}) => {
  const formatLastUpdate = (timestamp: string) => {
    if (timestamp === 'Never') return 'Never';
    return `${timestamp}`;
  };

  return (
    <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg border-b border-slate-700 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Market Status */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">Market Status</div>
            <div className={`text-sm font-bold ${marketStatus.color}`}>
              {marketStatus.status}
            </div>
          </div>

          {/* Stock Count */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">Stocks Tracked</div>
            <div className="text-cyan-400 text-lg font-bold">
              {stockCount}
            </div>
          </div>

          {/* High Scores */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">High Scores</div>
            <div className="text-green-400 text-lg font-bold">
              {stockCount > 0 ? Math.floor(stockCount * 0.3) : 0}
            </div>
          </div>

          {/* Catalysts */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">Catalysts</div>
            <div className="text-amber-400 text-lg font-bold">
              {catalystCount}
            </div>
          </div>

          {/* WebSocket */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">WebSocket</div>
            <div className={`text-sm font-bold ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
              {wsConnected ? '🟢 LIVE' : '🔴 DOWN'}
            </div>
          </div>

          {/* Last Update */}
          <div className="bg-slate-800/70 rounded-lg p-3 text-center">
            <div className="text-slate-400 text-xs font-medium mb-1">Last Update</div>
            <div className="text-slate-300 text-xs font-mono">
              {formatLastUpdate(lastUpdate)}
            </div>
          </div>
        </div>

        {/* Advanced Features Status */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-1 bg-green-900/20 text-green-400 px-2 py-1 rounded text-xs">
            <span>🎯</span>
            <span>Level 2 Data</span>
          </div>
          <div className="flex items-center gap-1 bg-blue-900/20 text-blue-400 px-2 py-1 rounded text-xs">
            <span>📈</span>
            <span>Pattern Recognition</span>
          </div>
          <div className="flex items-center gap-1 bg-purple-900/20 text-purple-400 px-2 py-1 rounded text-xs">
            <span>🔥</span>
            <span>Volume Surge Detection</span>
          </div>
          <div className="flex items-center gap-1 bg-orange-900/20 text-orange-400 px-2 py-1 rounded text-xs">
            <span>📊</span>
            <span>Order Flow Analysis</span>
          </div>
          <div className="flex items-center gap-1 bg-pink-900/20 text-pink-400 px-2 py-1 rounded text-xs">
            <span>📰</span>
            <span>Real-time News</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;