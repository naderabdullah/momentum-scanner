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
      </div>
    </div>
  );
};

export default Controls;