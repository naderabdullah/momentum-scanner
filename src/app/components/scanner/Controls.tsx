// src/app/components/scanner/Controls.tsx
import React from 'react';

interface ControlsProps {
  isScanning: boolean;
  startScan: () => void;
  stopScan: () => void;
  maxFloat: string;
  setMaxFloat: (value: string) => void;
  testAlert: (severity: 'info' | 'warning' | 'critical', ticker: string, message: string) => void;
  wsConnected?: boolean;
  forceMarketScan?: () => void;
}

const Controls: React.FC<ControlsProps> = ({ 
  isScanning, 
  startScan, 
  stopScan, 
  maxFloat, 
  setMaxFloat, 
  testAlert,
  wsConnected,
  forceMarketScan
}) => {
  return (
    <div className="p-4 bg-slate-900 flex flex-wrap gap-4 items-center justify-between sticky top-[92px] z-20 border-b border-slate-800">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${wsConnected === false ? 'bg-red-500' : wsConnected === true ? 'bg-green-500' : 'bg-gray-500'} animate-pulse`}></div>
          <span className="text-sm text-slate-400">
            {wsConnected === undefined ? 'Initializing...' : wsConnected ? 'Polygon Live' : 'Disconnected'}
          </span>
        </div>
        
        <button 
          onClick={startScan} 
          disabled={isScanning || (wsConnected !== undefined && !wsConnected)} 
          className="px-4 py-2 bg-cyan-600 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700 transition-all duration-300 btn-glow disabled:bg-slate-500 disabled:cursor-not-allowed"
        >
          {isScanning ? '📡 Live Scanning...' : '▶️ Start Market Scan'}
        </button>
        
        <button 
          onClick={stopScan} 
          disabled={!isScanning} 
          className="px-4 py-2 bg-rose-600 text-white font-semibold rounded-lg shadow-md hover:bg-rose-700 transition-all duration-300 btn-stop-glow disabled:bg-slate-500 disabled:cursor-not-allowed"
        >
          ⏹️ Stop Scan
        </button>
        
        {forceMarketScan && (
          <button 
            onClick={forceMarketScan} 
            disabled={!wsConnected}
            className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-all duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed"
            title="Force an immediate market scan"
          >
            🔄 Force Scan
          </button>
        )}
        
        <button 
          onClick={() => testAlert('warning', 'TEST', 'This is a test alert!')} 
          className="px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg shadow-md hover:bg-amber-600 transition-all"
        >
          Test Alert
        </button>
      </div>
      
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="maxFloat" className="block text-sm font-medium text-slate-400">
            Max Float (e.g., 50M)
          </label>
          <input 
            type="text" 
            id="maxFloat" 
            value={maxFloat} 
            onChange={(e) => setMaxFloat(e.target.value)} 
            className="mt-1 block w-36 bg-slate-800 border border-slate-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm" 
          />
        </div>
        
        <div className="text-xs text-slate-500">
          <div>Market scan runs every 30s</div>
          <div>Real-time updates every 1s</div>
        </div>
      </div>
    </div>
  );
};

export default Controls;