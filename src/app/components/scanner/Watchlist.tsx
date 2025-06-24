// src/app/components/scanner/Watchlist.tsx
import React, { useState, useMemo } from 'react';
import { Stock, UserPlan } from '../../lib/types';

interface WatchlistProps {
  stocks: Stock[];
  isLoading: boolean;
  userPlan?: UserPlan;
}

const Watchlist: React.FC<WatchlistProps> = ({ stocks, isLoading, userPlan }) => {
  const [sortBy, setSortBy] = useState<'buy_score' | 'change' | 'volume' | 'relVol'>('buy_score');
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [showOnlySignals, setShowOnlySignals] = useState(false);

  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatPrice = (price: number): string => {
    return price < 10 ? price.toFixed(3) : price.toFixed(2);
  };

  const formatPercent = (percent: number): string => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  };

  // Sort and filter stocks
  const processedStocks = useMemo(() => {
    let filtered = stocks;

    // Apply filters
    if (filterMinScore > 0) {
      filtered = filtered.filter(stock => stock.buy_score >= filterMinScore);
    }

    if (showOnlySignals) {
      filtered = filtered.filter(stock => stock.buy_score >= 75);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'buy_score':
          return b.buy_score - a.buy_score;
        case 'change':
          return Math.abs(b.todaysChangePerc) - Math.abs(a.todaysChangePerc);
        case 'volume':
          return b.day.v - a.day.v;
        case 'relVol':
          return b.relVol - a.relVol;
        default:
          return b.buy_score - a.buy_score;
      }
    });

    return filtered;
  }, [stocks, sortBy, filterMinScore, showOnlySignals]);

  // Get buy score styling
  const getBuyScoreStyle = (score: number) => {
    if (score >= 95) return { class: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white', text: 'STRONG BUY' };
    if (score >= 85) return { class: 'bg-gradient-to-r from-green-500 to-green-600 text-white', text: 'BUY' };
    if (score >= 75) return { class: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black', text: 'WATCH' };
    if (score >= 60) return { class: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white', text: 'MONITOR' };
    return { class: 'bg-slate-600 text-slate-300', text: 'NEUTRAL' };
  };

  // Check if criteria are met
  const checkCriteria = (stock: Stock) => {
    const meetsRelVol = stock.relVol >= 5;
    const meetsChange = Math.abs(stock.todaysChangePerc) >= 10;
    const meetsFloat = stock.float <= 20000000; // 20M
    const meetsPrice = stock.price >= 2 && stock.price <= 20;
    
    return { meetsRelVol, meetsChange, meetsFloat, meetsPrice };
  };

  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
      <p className="text-slate-400">Scanning market for momentum opportunities...</p>
      <p className="text-xs text-slate-500 mt-2">Real-time WebSocket feed loading</p>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="text-6xl mb-4">📊</div>
      <p className="text-slate-400 text-center">No stocks found matching criteria</p>
      <p className="text-xs text-slate-500 mt-2 text-center">
        Try adjusting filters or wait for market activity
      </p>
    </div>
  );

  const renderTableBody = () => {
    return processedStocks.map((stock, index) => {
      const criteria = checkCriteria(stock);
      const buyScoreStyle = getBuyScoreStyle(stock.buy_score);
      const changeColor = stock.todaysChangePerc >= 0 ? 'text-green-400' : 'text-red-400';
      const priceChangeIcon = stock.todaysChangePerc >= 0 ? '📈' : '📉';

      return (
        <tr 
          key={stock.ticker} 
          className={`border-b border-slate-800 hover:bg-slate-800/30 transition-colors ${
            stock.buy_score >= 90 ? 'bg-green-900/10' : 
            stock.buy_score >= 75 ? 'bg-amber-900/10' : ''
          }`}
        >
          {/* Rank & Symbol */}
          <td className="px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-6 text-right">#{index + 1}</span>
              <div>
                <div className="font-bold text-cyan-400 text-base">{stock.ticker}</div>
                {stock.patterns && stock.patterns.length > 0 && userPlan?.features.patternRecognition && (
                  <div className="text-xs text-indigo-400">🎯 {stock.patterns.length} pattern{stock.patterns.length !== 1 ? 's' : ''}</div>
                )}
              </div>
            </div>
          </td>

          {/* Price & Change */}
          <td className="px-3 py-3">
            <div className="text-right">
              <div className="font-mono font-bold text-white">${formatPrice(stock.price)}</div>
              <div className={`text-sm font-mono ${changeColor} flex items-center justify-end gap-1`}>
                <span>{priceChangeIcon}</span>
                <span>{formatPercent(stock.todaysChangePerc)}</span>
              </div>
            </div>
          </td>

          {/* Relative Volume */}
          <td className="px-3 py-3">
            <div className="text-right">
              <div className={`font-mono font-bold ${criteria.meetsRelVol ? 'text-green-400' : 'text-slate-400'}`}>
                {stock.relVol.toFixed(1)}x
              </div>
              {criteria.meetsRelVol && <div className="text-xs text-green-500">✓ Target</div>}
            </div>
          </td>

          {/* Float */}
          <td className="px-3 py-3">
            <div className="text-right">
              <div className={`font-mono text-sm ${criteria.meetsFloat ? 'text-green-400' : 'text-slate-400'}`}>
                {formatNumber(stock.float)}
              </div>
              {criteria.meetsFloat && <div className="text-xs text-green-500">✓ Small</div>}
            </div>
          </td>

          {/* Criteria Check */}
          <td className="px-3 py-3">
            <div className="flex items-center justify-center gap-1">
              <span className={`text-xs ${criteria.meetsPrice ? 'text-green-400' : 'text-slate-500'}`}>
                {criteria.meetsPrice ? '✓' : '✗'}
              </span>
              <span className="text-slate-600">|</span>
              <span className={`text-xs ${criteria.meetsChange ? 'text-green-400' : 'text-slate-500'}`}>
                {criteria.meetsChange ? '✓' : '✗'}
              </span>
            </div>
          </td>

          {/* News/Catalyst */}
          <td className="px-3 py-3 text-center">
            {stock.hasCatalyst ? (
              <div className="flex items-center justify-center">
                <span className="text-amber-400 text-lg">📰</span>
                {userPlan?.features.realTimeNews && (
                  <span className="text-xs text-amber-400 ml-1">LIVE</span>
                )}
              </div>
            ) : (
              <span className="text-slate-600">-</span>
            )}
          </td>

          {/* Volume */}
          <td className="px-3 py-3">
            <div className="text-right font-mono text-sm">
              {formatNumber(stock.day.v)}
              {stock.volumeSurge && (
                <div className="text-xs text-red-400">🔥 SURGE</div>
              )}
            </div>
          </td>

          {/* Buy Score */}
          <td className="px-3 py-3">
            <div className="flex flex-col items-center">
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${buyScoreStyle.class}`}>
                {stock.buy_score.toFixed(0)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {buyScoreStyle.text}
              </div>
            </div>
          </td>

          {/* Level 2 Action */}
          <td className="px-3 py-3 text-center">
            {userPlan?.features.level2Data ? (
              <button className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">
                📊 L2
              </button>
            ) : (
              <span className="text-slate-600 text-xs">🔒</span>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="lg:col-span-2 panel rounded-lg p-4 h-[calc(100vh-350px)] min-h-[400px] flex flex-col">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            🔥 Enhanced Momentum Scanner
            {userPlan?.level === 'advanced' && (
              <span className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
                ADVANCED
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time scoring • Enhanced criteria • Pattern recognition
          </p>
        </div>
        
        <div className="flex items-center gap-3 text-sm">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <label className="text-slate-400">Sort:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
            >
              <option value="buy_score">Buy Score</option>
              <option value="change">Price Change</option>
              <option value="volume">Volume</option>
              <option value="relVol">Rel Volume</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400">Min Score:</label>
            <select 
              value={filterMinScore} 
              onChange={(e) => setFilterMinScore(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
            >
              <option value={0}>All</option>
              <option value={60}>60+</option>
              <option value={75}>75+</option>
              <option value={85}>85+</option>
              <option value={90}>90+</option>
            </select>
          </div>

          <button
            onClick={() => setShowOnlySignals(!showOnlySignals)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              showOnlySignals 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {showOnlySignals ? '🎯 Signals Only' : 'Show All'}
          </button>
        </div>
      </div>
      
      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4 p-2 bg-slate-800/30 rounded-lg">
        <div className="text-sm text-slate-400">
          Showing <span className="text-cyan-400 font-bold">{processedStocks.length}</span> of <span className="text-cyan-400 font-bold">{stocks.length}</span> stocks
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Strong Buy: {stocks.filter(s => s.buy_score >= 90).length}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
            <span>Watch: {stocks.filter(s => s.buy_score >= 75 && s.buy_score < 90).length}</span>
          </div>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-auto flex-grow">
        {isLoading ? renderLoadingState() : 
         processedStocks.length === 0 ? renderEmptyState() : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-cyan-300 uppercase bg-slate-800/50 sticky top-0">
              <tr>
                <th className="px-3 py-3">Symbol</th>
                <th className="px-3 py-3 text-right">Price</th>
                <th className="px-3 py-3 text-right">RelVol</th>
                <th className="px-3 py-3 text-right">Float</th>
                <th className="px-3 py-3 text-center">Criteria</th>
                <th className="px-3 py-3 text-center">News</th>
                <th className="px-3 py-3 text-right">Volume</th>
                <th className="px-3 py-3 text-center">Score</th>
                <th className="px-3 py-3 text-center">L2</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {renderTableBody()}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-2 text-xs text-slate-500 border-t border-slate-800 pt-2">
        <div className="flex flex-col lg:flex-row justify-between gap-2">
          <div>
            <span className="font-medium">Enhanced Criteria:</span> RelVol ≥5x • Change ≥10% • Float ≤20M • $2-$20 • News Boost
          </div>
          <div className="flex items-center gap-4">
            <span className="text-cyan-400">🚀 Real-time WebSocket</span>
            {userPlan?.features.patternRecognition && (
              <span className="text-indigo-400">🎯 AI Patterns</span>
            )}
            {userPlan?.features.level2Data && (
              <span className="text-purple-400">📊 Level 2</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watchlist;