// src/app/components/scanner/InfoPanels.tsx
import React, { useState } from 'react';
import { Alert, Level2Data, PatternData, UserPlan } from '../../lib/types';

interface InfoPanelsProps {
  alerts: Alert[];
  level2Data: Level2Data[];
  patterns: PatternData; // Fixed type - now matches the expected Record<string, string[]>
  userPlan?: UserPlan;
  clearAlerts: () => void;
  clearLevel2Data: () => void;
  clearPatterns: () => void;
}

const InfoPanels: React.FC<InfoPanelsProps> = ({ 
  alerts, 
  level2Data, 
  patterns, 
  userPlan,
  clearAlerts, 
  clearLevel2Data, 
  clearPatterns 
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Filter alerts based on severity
  const filteredAlerts = alerts.filter(alert => 
    filterSeverity === 'all' || alert.severity === filterSeverity
  );

  // Check if user has access to advanced features
  const hasLevel2Access = userPlan?.features.level2Data || false;
  const hasPatternAccess = userPlan?.features.patternRecognition || false;
  const hasAdvancedAlerts = userPlan?.features.customAlerts || true;

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

  return (
    <div className="h-[calc(100vh-350px)] min-h-[400px] flex flex-col gap-4">
      {/* Real-Time Alerts Panel */}
      <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-rose-400">
            🚨 Real-Time Alerts
            {hasAdvancedAlerts && (
              <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                ADVANCED
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <select 
              value={filterSeverity} 
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-600"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <button 
              onClick={clearAlerts} 
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
            >
              Clear ({filteredAlerts.length})
            </button>
          </div>
        </div>
        
        <div className="space-y-2 overflow-y-auto flex-grow">
          {filteredAlerts.length === 0 ? 
            <div className="text-center pt-8 text-slate-500">
              <div className="text-4xl mb-2">📊</div>
              <p>No alerts yet. Market scanning in progress...</p>
            </div> :
            filteredAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`alert p-3 rounded-lg border-l-4 text-sm cursor-pointer transition-all hover:bg-slate-800/30 ${getSeverityColor(alert.severity)}`}
                onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold font-mono flex items-center gap-2">
                      <span>{getAlertIcon(alert.alertType)}</span>
                      <span className="text-cyan-400">[{alert.ticker}]</span>
                      <span className="text-xs text-slate-400 font-normal">
                        {formatAlertTime(alert.timestamp)}
                      </span>
                      {alert.alertType && (
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                          {alert.alertType.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">{alert.message}</div>
                    
                    {selectedAlert?.id === alert.id && (
                      <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs">
                        <div className="flex justify-between">
                          <span>Severity:</span>
                          <span className={alert.severity === 'critical' ? 'text-red-400' : 
                                          alert.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}>
                            {alert.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Timestamp:</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                        {alert.alertType && (
                          <div className="flex justify-between">
                            <span>Type:</span>
                            <span>{alert.alertType}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Level 2 Order Flow Panel */}
      <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-amber-400">
            📊 Level 2 Order Flow
            {hasLevel2Access && (
              <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                ADVANCED
              </span>
            )}
          </h2>
          <button 
            onClick={clearLevel2Data} 
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            Clear ({level2Data.length})
          </button>
        </div>
        
        <div className="space-y-3 font-mono text-sm overflow-y-auto flex-grow">
          {!hasLevel2Access ? (
            <div className="text-center pt-8 text-slate-500">
              <div className="text-4xl mb-2">🔒</div>
              <p>Level 2 data requires Advanced Plan</p>
              <p className="text-xs mt-2">Upgrade to access real-time order flow</p>
            </div>
          ) : level2Data.length === 0 ? (
            <div className="text-center pt-8 text-slate-500">
              <div className="text-4xl mb-2">📊</div>
              <p>Level 2 data will appear here</p>
              <p className="text-xs mt-2">Real-time bid/ask with order flow analysis</p>
            </div>
          ) : (
            level2Data.map(q => {
              const imbalance = q.imbalance || 0;
              const spreadBps = calculateSpreadBps(q.spread, q.bid_price);
              const orderFlow = q.orderFlow || 'neutral';
              
              return (
                <div key={`${q.ticker}-${q.timestamp}`} className="p-3 bg-slate-800/50 rounded-md border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-cyan-400">{q.ticker}</div>
                    <div className={`font-bold ${getOrderFlowColor(orderFlow)}`}>
                      {getOrderFlowText(orderFlow)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bid:</span>
                        <span className="text-green-400">
                          ${q.bid_price.toFixed(2)} × {q.bid_size.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ask:</span>
                        <span className="text-red-400">
                          ${q.ask_price.toFixed(2)} × {q.ask_size.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Spread:</span>
                        <span className="text-amber-400">
                          {spreadBps.toFixed(0)} bps
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Imbalance:</span>
                        <span className={imbalance > 0.1 ? 'text-green-400' : 
                                        imbalance < -0.1 ? 'text-red-400' : 'text-slate-400'}>
                          {(imbalance * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Flow Visualization */}
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Sell Pressure</span>
                      <span>Buy Pressure</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          imbalance > 0.1 ? 'bg-gradient-to-r from-red-500 to-green-500' :
                          imbalance < -0.1 ? 'bg-gradient-to-r from-red-500 to-red-300' :
                          'bg-gradient-to-r from-amber-500 to-amber-300'
                        }`}
                        style={{ width: `${Math.max(10, Math.min(90, 50 + (imbalance * 100)))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pattern Recognition Panel */}
      <div className="panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-indigo-400">
            🎯 Pattern Recognition
            {hasPatternAccess && (
              <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                ADVANCED
              </span>
            )}
          </h2>
          <button 
            onClick={clearPatterns} 
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            Clear ({Object.keys(patterns).length})
          </button>
        </div>
        
        <div className="space-y-2 overflow-y-auto flex-grow">
          {!hasPatternAccess ? (
            <div className="text-center pt-8 text-slate-500">
              <div className="text-4xl mb-2">🔒</div>
              <p>Pattern recognition requires Advanced Plan</p>
              <p className="text-xs mt-2">Upgrade to access AI-powered technical analysis</p>
            </div>
          ) : Object.keys(patterns).length === 0 ? (
            <div className="text-center pt-8 text-slate-500">
              <div className="text-4xl mb-2">🎯</div>
              <p>Pattern signals will appear here</p>
              <p className="text-xs mt-2">Bull flags, breakouts, and more detected in real-time</p>
            </div>
          ) : (
            Object.entries(patterns).map(([ticker, patternList]) => (
              <div key={ticker} className="p-3 bg-slate-800/50 rounded-md border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold text-indigo-400">{ticker}</div>
                  <div className="text-xs text-slate-400">
                    {patternList.length} pattern{patternList.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {patternList.map((pattern, index) => (
                    <span 
                      key={index}
                      className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded-full border border-indigo-700"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InfoPanels;