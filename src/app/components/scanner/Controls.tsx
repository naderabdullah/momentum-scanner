// src/app/components/scanner/Controls.tsx
import React, { useState } from 'react';

interface ControlsProps {
  isScanning: boolean;
  startScan: () => void;
  stopScan: () => void;
  maxFloat: string;
  setMaxFloat: (value: string) => void;
  testAlert: () => void;
  wsConnected: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  isScanning,
  startScan,
  stopScan,
  maxFloat,
  setMaxFloat,
  testAlert,
  wsConnected
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
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/25"
                >
                  🚀 START SCANNING
                </button>
              ) : (
                <button
                  onClick={stopScan}
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/25"
                >
                  ⏹️ STOP SCANNING
                </button>
              )}
            </div>

            {/* Max Float Input */}
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-sm font-medium">Max Float:</label>
              <input
                type="text"
                value={tempMaxFloat}
                onChange={(e) => handleFloatChange(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white px-3 py-1 rounded-lg text-sm w-20 focus:outline-none focus:border-cyan-500"
                placeholder="20M"
              />
            </div>
          </div>

          {/* Right Side: Status & Settings */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`text-sm font-medium ${connectionStatus.color}`}>
                {connectionStatus.text}
              </div>
            </div>

            {/* Plan Status - Always Advanced */}
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full">
                ADVANCED PLAN
              </div>
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

              {/* Feature Status - All Enabled */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-indigo-400">🎯 Features</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Level 2 Data:</span>
                    <span className="text-green-400">✓ ON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pattern Recognition:</span>
                    <span className="text-green-400">✓ ON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volume Surge:</span>
                    <span className="text-green-400">✓ ON</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Order Flow:</span>
                    <span className="text-green-400">✓ ON</span>
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
                      {wsConnected ? '✓ CONNECTED' : '✗ DISCONNECTED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Real-time Data:</span>
                    <span className="text-green-400">✓ ACTIVE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pattern Detection:</span>
                    <span className="text-green-400">✓ RUNNING</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Volume Analysis:</span>
                    <span className="text-green-400">✓ ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Controls;