// components/scanner/InfoPanels.tsx
import React from 'react';
import { Alert, Level2Data } from '../../lib/types';

interface InfoPanelsProps {
  alerts: Alert[];
  level2Data: Level2Data[];
  patterns: Record<string, string[]>;
  // --- NEW: Define clear functions in props interface ---
  clearAlerts: () => void;
  clearLevel2Data: () => void;
  clearPatterns: () => void;
}

const InfoPanels: React.FC<InfoPanelsProps> = ({ alerts, level2Data, patterns, clearAlerts, clearLevel2Data, clearPatterns }) => {
  return (
    <div className="h-[calc(100vh-350px)] min-h-[400px] flex flex-col gap-4">
      <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        {/* --- NEW: Header container for title and button --- */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-rose-400">🚨 Real-Time Alerts</h2>
          <button onClick={clearAlerts} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">Clear</button>
        </div>
        <div className="space-y-2 overflow-y-auto flex-grow">
          {alerts.length === 0 ? <p className="text-center pt-8 text-slate-500">No alerts yet.</p> :
            alerts.map(alert => (
              <div key={alert.id} className={`alert ${alert.severity} p-3 rounded-lg border-l-4 text-sm`}>
                <div className="font-bold font-mono">[{alert.ticker}] <span className="text-xs text-slate-400 font-normal">{new Date(alert.timestamp).toLocaleTimeString()}</span></div>
                <div>{alert.message}</div>
              </div>
            ))
          }
        </div>
      </div>
      <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        {/* --- NEW: Header container for title and button --- */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-amber-400">📊 Order Flow</h2>
          <button onClick={clearLevel2Data} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">Clear</button>
        </div>
        <div className="space-y-3 font-mono text-sm overflow-y-auto flex-grow">
          {level2Data.length === 0 ? <p className="text-center pt-8 text-slate-500">Level 2 data will appear here.</p> :
            level2Data.map(q => {
               const imbalance = (q.bid_size - q.ask_size) / (q.bid_size + q.ask_size);
               let pClass = 'text-amber-400', pText = 'NEUTRAL';
               if (imbalance > 0.3) { pClass = 'text-green-400'; pText = 'BUYING'; }
               if (imbalance < -0.3) { pClass = 'text-red-400'; pText = 'SELLING'; }
               return (
                <div key={q.ticker} className="p-2 bg-slate-800/50 rounded-md">
                    <div className="font-bold text-cyan-400">{q.ticker} <span className={pClass}>{pText}</span></div>
                    <div className="flex justify-between"><span>Bid:</span> <span className="text-green-400">${q.bid_price.toFixed(2)} x {q.bid_size}</span></div>
                    <div className="flex justify-between"><span>Ask:</span> <span className="text-red-400">${q.ask_price.toFixed(2)} x {q.ask_size}</span></div>
                </div>
               )
            })
          }
        </div>
      </div>
       <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        {/* --- NEW: Header container for title and button --- */}
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-indigo-400">🎯 Pattern Recognition</h2>
          <button onClick={clearPatterns} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors">Clear</button>
        </div>
        <div className="space-y-2 overflow-y-auto flex-grow">
           {Object.keys(patterns).length === 0 ? <p className="text-center pt-8 text-slate-500">Pattern signals will appear here.</p> :
             Object.entries(patterns).map(([ticker, patternList]) => (
                <div key={ticker} className="p-2 bg-slate-800/50 rounded-md">
                    <div className="font-bold text-indigo-400">{ticker}</div>
                    <div className="text-sm">{patternList.join(', ')}</div>
                </div>
             ))
           }
        </div>
      </div>
    </div>
  );
};

export default InfoPanels;
