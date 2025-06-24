// src/app/components/scanner/Controls.tsx
import React, { useState } from 'react';
import { UserPlan } from '../../lib/types';

interface ControlsProps {
  isScanning: boolean;
  startScan: () => void;
  stopScan: () => void;
  maxFloat: string;
  setMaxFloat: (value: string) => void;
  testAlert: () => void;
  wsConnected: boolean;
  userPlan?: UserPlan;
  upgradePlan?: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  isScanning,
  startScan,
  stopScan,
  maxFloat,
  setMaxFloat,
  testAlert,
  wsConnected,
  userPlan,
  upgradePlan
}) => {
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [tempMaxFloat, setTempMaxFloat] = useState(maxFloat);

  const handleFloatChange = (value: string) => {
    setTempMaxFloat(value);
    setMaxFloat(value);
  };

  const getConnectionStatus = () => {
    if (!wsConnected) return { text: '🔴 DISCONNECTED', color: 'text-red-400' };
    if (isScanning) return { text: '🟢 SCANNING', color: 'text-green-400' };
    return { text: '🟡 CONNECTED', color: 'text-yellow-400' };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="sticky top-[73px] z-10 bg-slate-900/95 backdrop-filter backdrop-blur-lg border-b border-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left Side: Scan Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {!isScanning ? (
                <button
                  onClick={startScan}
                  disabled={!wsConnected}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-slate-600 disabled:to-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25"
                >
                  🚀 START SCAN
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/25"
                >
                  ⏹️ STOP SCAN
                </button>
              )}
              
              <div className={`text-sm font-mono font-bold ${connectionStatus.color}`}>
                {connectionStatus.text}
              </div>
            </div>

            {/* Real-time indicator */}
            {isScanning && (
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">LIVE FEED</span>
              </div>
            )}
          </div>

          {/* Center: Quick Settings */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-400">Max Float:</label>
              <select
                value={tempMaxFloat}
                onChange={(e) => handleFloatChange(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm font-mono focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="5M">5M</option>
                <option value="10M">10M</option>
                <option value="20M">20M ⭐</option>
                <option value="50M">50M</option>
                <option value="100M">100M</option>
                <option value="500M">500M</option>
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg transition-colors"
            >
              ⚙️ Settings
            </button>
          </div>

          {/* Right Side: Plan & Actions */}
          <div className="flex items-center gap-4">
            {/* Plan Badge */}
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                userPlan?.level === 'advanced' 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {userPlan?.level?.toUpperCase() || 'BASIC'} PLAN
              </div>
              
              {userPlan?.level !== 'advanced' && upgradePlan && (
                <button
                  onClick={upgradePlan}
                  className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-full transition-all duration-200"
                >
                  🚀 UPGRADE
                </button>
              )}
            </div>

            <button
              onClick={testAlert}
              className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg transition-colors"
            >
              🧪 Test
            </button>
          </div>
        </div>

        {/* Advanced Settings Panel */}
        {showAdvancedSettings && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Scanning Criteria */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-cyan-400">📊 Scanning Criteria</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Rel Volume:</span>
                    <span className="text-green-400 font-mono">5.0x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Price Change:</span>
                    <span className="text-green-400 font-mono">10.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price Range:</span>
                    <span className="text-green-400 font-mono">$2-$20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Float:</span>
                    <span className="text-green-400 font-mono">{maxFloat}</span>
                  </div>
                </div>
              </div>

              {/* Feature Status */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-indigo-400">🎯 Features</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Level 2 Data:</span>
                    <span className={userPlan?.features.level2Data ? 'text-green-400' : 'text-red-400'}>
                      {userPlan?.features.level2Data ? '✓ ON' : '✗ OFF'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pattern Recognition:</span>
                    <span className={userPlan?.features.patternRecognition ? 'text-green-400' : 'text-red-400'}>
                      {userPlan?.features.patternRecognition ? '✓ ON' : '✗ OFF'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volume Surge:</span>
                    <span className={userPlan?.features.volumeSurgeDetection ? 'text-green-400' : 'text-amber-400'}>
                      {userPlan?.features.volumeSurgeDetection ? '✓ ON' : '~ BASIC'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Order Flow:</span>
                    <span className={userPlan?.features.orderFlowAnalysis ? 'text-green-400' : 'text-red-400'}>
                      {userPlan?.features.orderFlowAnalysis ? '✓ ON' : '✗ OFF'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Buy Score Weights */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-amber-400">⚖️ Score Weights</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rel Volume:</span>
                    <span className="text-amber-400 font-mono">30%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price Change:</span>
                    <span className="text-amber-400 font-mono">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Float Size:</span>
                    <span className="text-amber-400 font-mono">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price Range:</span>
                    <span className="text-amber-400 font-mono">10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">News + Patterns:</span>
                    <span className="text-amber-400 font-mono">15%</span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-rose-400">📈 Performance</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">WebSocket:</span>
                    <span className={wsConnected ? 'text-green-400' : 'text-red-400'}>
                      {wsConnected ? '🟢 LIVE' : '🔴 DOWN'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Scan Mode:</span>
                    <span className="text-blue-400">REAL-TIME</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Update Rate:</span>
                    <span className="text-blue-400">15s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Data Source:</span>
                    <span className="text-blue-400">POLYGON</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Feature Callouts */}
            {userPlan?.level !== 'advanced' && (
              <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold text-purple-400">🚀 Unlock Advanced Features</h5>
                    <p className="text-xs text-slate-300 mt-1">
                      Get Level 2 data, AI pattern recognition, order flow analysis, and real-time news
                    </p>
                  </div>
                  {upgradePlan && (
                    <button
                      onClick={upgradePlan}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold rounded-lg transition-all duration-200"
                    >
                      UPGRADE NOW
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <span>📊</span>
            <span>Real-time WebSocket feed</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🎯</span>
            <span>Enhanced buy scoring</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⚡</span>
            <span>Volume surge detection</span>
          </div>
          {userPlan?.features.patternRecognition && (
            <div className="flex items-center gap-1">
              <span>🤖</span>
              <span>AI pattern recognition</span>
            </div>
          )}
          {userPlan?.features.level2Data && (
            <div className="flex items-center gap-1">
              <span>📈</span>
              <span>Level 2 order flow</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Controls;