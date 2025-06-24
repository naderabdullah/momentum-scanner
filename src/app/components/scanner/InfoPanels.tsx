// src/app/components/scanner/InfoPanels.tsx
import React, { useState } from 'react';
import { Alert, Level2Data, PatternData } from '../../lib/types';

interface InfoPanelsProps {
  alerts: Alert[];
  level2Data: Level2Data[];
  patterns: PatternData;
  clearAlerts: () => void;
  deleteAlert: (alertId: number) => void; // NEW: Individual alert deletion
  clearLevel2Data: () => void;
  clearPatterns: () => void;
}

const InfoPanels: React.FC<InfoPanelsProps> = ({ 
  alerts, 
  level2Data, 
  patterns, 
  clearAlerts, 
  deleteAlert, // NEW
  clearLevel2Data, 
  clearPatterns 
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Filter alerts based on severity
  const filteredAlerts = alerts.filter(alert => 
    filterSeverity === 'all' || alert.severity === filterSeverity
  );

  const formatAlertTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getAlertIcon = (alertType?: string): string => {
    switch (alertType) {
      case 'buy_signal': return '🚀';
      case 'volume_surge': return '📈';
      case 'pattern_detected': return '🎯';
      case 'price_breakout': return '💥';
      case 'news_catalyst': return '📰';
      case 'system': return '⚙️';
      default: return '🚨';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-900/20';
      case 'warning': return 'border-yellow-500 bg-yellow-900/20';
      case 'info': return 'border-blue-500 bg-blue-900/20';
      default: return 'border-gray-500 bg-gray-900/20';
    }
  };

  const getOrderFlowText = (orderFlow?: string): string => {
    switch (orderFlow) {
      case 'buying': return 'BUYING';
      case 'selling': return 'SELLING';
      default: return 'NEUTRAL';
    }
  };

  return (
    <div className="space-y-4">
      {/* Alerts Panel - REMOVED max-h-64 */}
      <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🚨 Real-time Alerts
              {alerts.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="bg-slate-700 text-white px-2 py-1 rounded text-xs border border-slate-600"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
              <button
                onClick={clearAlerts}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 h-44 overflow-y-auto">
          <div className="space-y-2">
            {filteredAlerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 cursor-pointer hover:bg-slate-700/30 transition-colors ${getSeverityColor(alert.severity)}`}
                onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{getAlertIcon(alert.alertType)}</span>
                    <span className="font-medium text-white text-sm">{alert.ticker}</span>
                    <span className="text-xs text-slate-400">
                      {formatAlertTime(alert.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-900 text-red-400' :
                      alert.severity === 'warning' ? 'bg-yellow-900 text-yellow-400' :
                      'bg-blue-900 text-blue-400'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    {/* NEW: Individual delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAlert(alert.id);
                      }}
                      className="text-slate-400 hover:text-red-400 text-xs px-1 py-0.5 hover:bg-slate-600 rounded transition-colors"
                      title="Delete alert"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mt-1">{alert.message}</p>
              </div>
            ))}
            
            {filteredAlerts.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                {filterSeverity === 'all' ? 'No alerts yet' : `No ${filterSeverity} alerts`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Level 2 Panel - REMOVED max-h-64 */}
      <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              📊 Level 2 Order Flow
              {level2Data.length > 0 && (
                <span className="bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {level2Data.length}
                </span>
              )}
            </h3>
            <button
              onClick={clearLevel2Data}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>

        <div className="p-4 h-42 overflow-y-auto">
          <div className="space-y-3">
            {level2Data.slice(0, 5).map((data, index) => (
              <div key={`${data.ticker}-${index}`} className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">{data.ticker}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      data.orderFlow === 'buying' ? 'bg-green-900 text-green-400' :
                      data.orderFlow === 'selling' ? 'bg-red-900 text-red-400' :
                      'bg-slate-900 text-slate-400'
                    }`}>
                      {getOrderFlowText(data.orderFlow)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Bid</div>
                    <div className="text-green-400 font-mono">
                      ${data.bid_price.toFixed(2)} × {data.bid_size}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Ask</div>
                    <div className="text-red-400 font-mono">
                      ${data.ask_price.toFixed(2)} × {data.ask_size}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Spread</div>
                    <div className="text-yellow-400 font-mono">
                      ${data.spread.toFixed(3)} ({data.spreadPercent.toFixed(2)}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Imbalance</div>
                    <div className={`font-mono ${(data.imbalance || 0) > 0 ? 
                      'text-green-400' : 'text-red-400'}`}>
                      {((data.imbalance || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {level2Data.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                No Level 2 data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patterns Panel - REMOVED max-h-64 */}
      <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              🎯 Pattern Recognition
              {Object.keys(patterns).length > 0 && (
                <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {Object.keys(patterns).length}
                </span>
              )}
            </h3>
            <button
              onClick={clearPatterns}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>

        <div className="p-4 h-58 overflow-y-auto">
          <div className="space-y-3">
            {Object.entries(patterns).slice(0, 5).map(([ticker, patternList]) => (
              <div key={ticker} className="bg-slate-700/50 rounded-lg p-3">
                <h4 className="font-medium text-white mb-2">{ticker}</h4>
                <div className="space-y-2">
                  {patternList.map((patternName, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-medium text-sm">{patternName}</span>
                        <span className="text-xs text-slate-400">• Real-time</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-900 text-blue-400 rounded text-xs">
                          DETECTED
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {Object.keys(patterns).length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                No patterns detected yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoPanels;