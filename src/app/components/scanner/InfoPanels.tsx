// src/app/components/scanner/InfoPanels.tsx
import React, { useState } from 'react';
import { Alert, Level2Data, PatternData } from '../../lib/types';

interface InfoPanelsProps {
  alerts: Alert[];
  level2Data: Level2Data[];
  patterns: PatternData;
  clearAlerts: () => void;
  clearLevel2Data: () => void;
  clearPatterns: () => void;
}

const InfoPanels: React.FC<InfoPanelsProps> = ({ 
  alerts, 
  level2Data, 
  patterns, 
  clearAlerts, 
  clearLevel2Data, 
  clearPatterns 
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'alerts' | 'level2' | 'patterns'>('alerts');

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

  const calculateSpreadBps = (spread: number, price: number): number => {
    return (spread / price) * 10000; // Convert to basis points
  };

  const getOrderFlowColor = (orderFlow?: string): string => {
    switch (orderFlow) {
      case 'buying': return 'text-green-400';
      case 'selling': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const getOrderFlowText = (orderFlow?: string): string => {
    switch (orderFlow) {
      case 'buying': return 'BUYING';
      case 'selling': return 'SELLING';
      default: return 'NEUTRAL';
    }
  };

  const TabButton = ({ tab, label, count }: { tab: 'alerts' | 'level2' | 'patterns', label: string, count?: number }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        activeTab === tab
          ? 'bg-cyan-600 text-white'
          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden">
      {/* Header with Tabs */}
      <div className="bg-slate-800/70 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">📊 Advanced Analytics</h2>
          <div className="flex items-center gap-1 bg-green-900/20 text-green-400 px-2 py-1 rounded text-xs">
            <span>✨</span>
            <span>Real-time</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <TabButton tab="alerts" label="🚨 Alerts" count={alerts.length} />
          <TabButton tab="level2" label="📊 Level 2" count={level2Data.length} />
          <TabButton tab="patterns" label="🎯 Patterns" count={Object.keys(patterns).length} />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="bg-slate-700 text-white px-3 py-1 rounded text-sm border border-slate-600"
                >
                  <option value="all">All Alerts</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
              
              <button
                onClick={clearAlerts}
                className="text-slate-400 hover:text-white text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            </div>

            <div className="space-y-2">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer hover:bg-slate-700/30 transition-colors ${getSeverityColor(alert.severity)}`}
                  onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getAlertIcon(alert.alertType)}</span>
                      <span className="font-medium text-white">{alert.ticker}</span>
                      <span className="text-xs text-slate-400">
                        {formatAlertTime(alert.timestamp)}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-900 text-red-400' :
                      alert.severity === 'warning' ? 'bg-yellow-900 text-yellow-400' :
                      'bg-blue-900 text-blue-400'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm mt-1">{alert.message}</p>
                  
                  {selectedAlert?.id === alert.id && (
                    <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-400">
                      <div>Alert ID: {alert.id}</div>
                      <div>Type: {alert.alertType || 'general'}</div>
                      <div>Timestamp: {new Date(alert.timestamp).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              ))}
              
              {filteredAlerts.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  {filterSeverity === 'all' ? 'No alerts yet' : `No ${filterSeverity} alerts`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Level 2 Tab */}
        {activeTab === 'level2' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Real-time Order Flow</h3>
              <button
                onClick={clearLevel2Data}
                className="text-slate-400 hover:text-white text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            </div>

            <div className="space-y-3">
              {level2Data.map((data, index) => (
                <div key={`${data.ticker}-${index}`} className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white text-lg">{data.ticker}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        data.orderFlow === 'buying' ? 'bg-green-900 text-green-400' :
                        data.orderFlow === 'selling' ? 'bg-red-900 text-red-400' :
                        'bg-slate-600 text-slate-300'
                      }`}>
                        {getOrderFlowText(data.orderFlow)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatAlertTime(data.timestamp)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bid:</span>
                        <span className="text-green-400 font-mono">
                          ${data.bid_price?.toFixed(2)} x {data.bid_size?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ask:</span>
                        <span className="text-red-400 font-mono">
                          ${data.ask_price?.toFixed(2)} x {data.ask_size?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spread:</span>
                        <span className="text-white font-mono">
                          ${data.spread?.toFixed(3)} ({data.spreadPercent?.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spread (bps):</span>
                        <span className="text-cyan-400 font-mono">
                          {calculateSpreadBps(data.spread || 0, data.bid_price || 1).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {data.imbalance !== undefined && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Order Imbalance:</span>
                        <span className={`font-mono ${data.imbalance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {((data.imbalance || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {level2Data.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No Level 2 data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Pattern Recognition</h3>
              <button
                onClick={clearPatterns}
                className="text-slate-400 hover:text-white text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                🗑️ Clear
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(patterns).map(([ticker, patternList]) => (
                <div key={ticker} className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-white text-lg mb-3">{ticker}</h4>
                  <div className="space-y-2">
                    {patternList.map((patternName, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 font-medium">{patternName}</span>
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
                <div className="text-center py-8 text-slate-400">
                  No patterns detected yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoPanels;