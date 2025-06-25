// src/app/components/scanner/InfoPanels.tsx
import React, { useState } from 'react';
import { Alert, Level2Data, PatternData } from '../../lib/types';

interface InfoPanelsProps {
  alerts: Alert[];
  level2Data: Level2Data[];
  patterns: PatternData;
  selectedStock: string | null; // NEW: Selected stock for L2 display
  clearAlerts: () => void;
  deleteAlert: (alertId: number) => void;
  clearPatterns: () => void;
}

const InfoPanels: React.FC<InfoPanelsProps> = ({ 
  alerts, 
  level2Data, 
  patterns, 
  selectedStock, // NEW
  clearAlerts, 
  deleteAlert,
  clearPatterns 
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Filter alerts based on severity
  const filteredAlerts = alerts.filter(alert => 
    filterSeverity === 'all' || alert.severity === filterSeverity
  );

  // NEW: Filter L2 data for selected stock only
  const selectedStockL2Data = selectedStock 
    ? level2Data.filter(data => data.ticker === selectedStock)
    : [];

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
      {/* Alerts Panel */}
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

      {/* Level 2 Panel - UPDATED: Now shows data for selected stock only */}
      <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              📊 Level 2 Data
              {selectedStock && (
                <span className="bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {selectedStock}
                </span>
              )}
            </h3>
            {/* REMOVED: Clear button - no longer needed */}
          </div>
        </div>

        <div className="p-4 h-57 overflow-y-auto">
          <div className="space-y-3">
            {!selectedStock && (
              <div className="text-center py-6 text-slate-400 text-sm">
                <div className="text-slate-400 mb-2">📊 Select a stock to view Level 2 data</div>
                <div className="text-slate-500 text-xs">Click the "📊 L2" button on any stock in the watchlist</div>
              </div>
            )}

            {selectedStock && selectedStockL2Data.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                <div className="text-slate-400 mb-2">No Level 2 data available for {selectedStock}</div>
                <div className="text-slate-500 text-xs">Data will appear here when available</div>
              </div>
            )}

            {selectedStockL2Data.map((data, index) => (
              <div key={`${data.ticker}-${index}`} className="bg-gradient-to-r from-slate-700/30 to-slate-600/30 rounded-lg p-4 border border-slate-600/50 hover:border-cyan-500/30 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-white text-lg flex items-center gap-2">
                    📊 {data.ticker}
                    <span className="text-cyan-400 text-sm font-normal">Level II</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      data.orderFlow === 'buying' ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white' :
                      data.orderFlow === 'selling' ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white' :
                      'bg-gradient-to-r from-slate-600 to-slate-700 text-slate-300'
                    }`}>
                      {getOrderFlowText(data.orderFlow)}
                    </span>
                    <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
                      {new Date(data.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-blue-500">
                    <div className="text-blue-400 text-xs font-semibold mb-1 flex items-center gap-1">
                      💰 BID/ASK SPREAD
                    </div>
                    <div className="text-white font-mono text-lg font-bold">
                      <span className="text-green-400">${data.bid_price?.toFixed(2)}</span>
                      <span className="text-slate-500 mx-2">/</span>
                      <span className="text-red-400">${data.ask_price?.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Spread: <span className="text-amber-400">${(data.spread || 0).toFixed(3)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-lg p-3 border-l-4 border-purple-500">
                    <div className="text-purple-400 text-xs font-semibold mb-1 flex items-center gap-1">
                      ⚖️ ORDER IMBALANCE
                    </div>
                    <div className={`font-mono text-lg font-bold ${
                      data.imbalance && data.imbalance > 0 ? 'text-green-400' : 
                      data.imbalance && data.imbalance < 0 ? 'text-red-400' : 
                      'text-slate-400'
                    }`}>
                      {((data.imbalance || 0) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {data.imbalance && data.imbalance > 0 ? '🟢 Buy Pressure' : 
                       data.imbalance && data.imbalance < 0 ? '🔴 Sell Pressure' : 
                       '⚪ Balanced'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>📈 Sizes:</span>
                    <span className="text-green-400">{data.bid_size} bid</span>
                    <span className="text-slate-500">×</span>
                    <span className="text-red-400">{data.ask_size} ask</span>
                  </div>
                  <div className="text-slate-400">
                    💹 Spread: <span className="text-amber-400">{(data.spreadPercent || 0).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patterns Panel */}
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

        <div className="p-4 h-25 overflow-y-auto">
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