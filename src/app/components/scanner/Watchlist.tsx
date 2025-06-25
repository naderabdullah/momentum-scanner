// src/app/components/scanner/Watchlist.tsx
import React, { useState } from 'react';
import { Stock } from '../../lib/types';

interface WatchlistProps {
  stocks: Stock[];
  isLoading: boolean;
  clearStocks: () => void;
  onShowLevel2: (ticker: string) => void; // NEW: Callback for L2 button click
}

const Watchlist: React.FC<WatchlistProps> = ({ 
  stocks, 
  isLoading, 
  clearStocks, 
  onShowLevel2 // NEW
}) => {
  const [sortBy, setSortBy] = useState<keyof Stock>('buy_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Format numbers for display
  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(1)}B`;
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
  };

  const formatPercentage = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  // Get buy score styling
  const getBuyScoreStyle = (score: number) => {
    if (score >= 80) {
      return {
        class: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white',
        text: 'STRONG BUY'
      };
    }
    if (score >= 60) {
      return {
        class: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white',
        text: 'BUY'
      };
    }
    if (score >= 40) {
      return {
        class: 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white',
        text: 'HOLD'
      };
    }
    return {
      class: 'bg-gradient-to-r from-red-600 to-rose-600 text-white',
      text: 'AVOID'
    };
  };

  // Sort stocks
  const sortedStocks = [...stocks].sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    
    if (sortOrder === 'desc') {
      return bVal - aVal;
    }
    return aVal - bVal;
  });

  // Check if stock meets basic criteria
  const getStockCriteria = (stock: Stock) => {
    return {
      meetsVolume: stock.relVol >= 5,
      meetsPrice: stock.price >= 2 && stock.price <= 20,
      meetsChange: Math.abs(stock.todaysChangePerc) >= 10,
      meetsFloat: stock.float <= 20000000
    };
  };

  const handleSort = (column: keyof Stock) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="lg:col-span-2 bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <p className="text-slate-400">🔍 Scanning for opportunities...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-2 bg-slate-800/50 backdrop-filter backdrop-blur-lg rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="bg-slate-800/70 px-6 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            🎯 Live Stock Scanner
          </h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-400">
              Showing {stocks.length} stocks
            </div>
            <div className="flex items-center gap-1 bg-green-900/20 text-green-400 px-2 py-1 rounded text-xs">
              <span>✨</span>
              <span>All Features Active</span>
            </div>
            <button
              onClick={clearStocks}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              title="Clear watchlist"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* Table with fixed height and scrolling */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 sticky top-0">
            <tr>
              <th 
                className="px-3 py-3 text-left text-slate-300 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('ticker')}
              >
                Symbol {sortBy === 'ticker' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-3 py-3 text-left text-slate-300 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('price')}
              >
                Price {sortBy === 'price' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-3 py-3 text-left text-slate-300 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('todaysChangePerc')}
              >
                Change {sortBy === 'todaysChangePerc' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th 
                className="px-3 py-3 text-left text-slate-300 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('relVol')}
              >
                Rel Vol {sortBy === 'relVol' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-3 py-3 text-left text-slate-300 font-medium">
                Criteria
              </th>
              <th className="px-3 py-3 text-center text-slate-300 font-medium">
                News
              </th>
              <th className="px-3 py-3 text-right text-slate-300 font-medium">
                Volume
              </th>
              <th 
                className="px-3 py-3 text-center text-slate-300 font-medium cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('buy_score')}
              >
                Buy Score {sortBy === 'buy_score' && (sortOrder === 'desc' ? '↓' : '↑')}
              </th>
              <th className="px-3 py-3 text-center text-slate-300 font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {sortedStocks.map((stock) => {
              const isPositive = stock.todaysChangePerc >= 0;
              const buyScoreStyle = getBuyScoreStyle(stock.buy_score);
              const criteria = getStockCriteria(stock);

              return (
                <tr key={stock.ticker} className="hover:bg-slate-700/30 transition-colors">
                  {/* Symbol */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{stock.ticker}</span>
                      <div className="flex items-center gap-1 text-xs">
                        <span className={`${stock.relVol >= 5 ? 
                          'text-green-400' : 'text-slate-500'}`}>
                          Vol: {stock.relVol.toFixed(1)}x
                        </span>
                        {stock.volumeSurge && (
                          <span className="text-red-400">🔥</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-3 py-3">
                    <div className="font-mono font-bold text-white">
                      {formatPrice(stock.price)}
                    </div>
                  </td>

                  {/* Change */}
                  <td className="px-3 py-3">
                    <div className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercentage(stock.todaysChangePerc)}
                    </div>
                    <div className={`text-xs ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
                      {isPositive ? '+' : ''}{stock.todaysChange?.toFixed(2)}
                    </div>
                  </td>

                  {/* Relative Volume */}
                  <td className="px-3 py-3">
                    <div className={`font-mono ${stock.relVol >= 5 ? 'text-green-400' : 'text-slate-300'}`}>
                      {stock.relVol.toFixed(1)}x
                    </div>
                  </td>

                  {/* Criteria */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className={`${criteria.meetsVolume ? 'text-green-400' : 'text-slate-500'}`}>
                        {criteria.meetsVolume ? '✓' : '✗'}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className={`${criteria.meetsPrice ? 'text-green-400' : 'text-slate-500'}`}>
                        {criteria.meetsPrice ? '✓' : '✗'}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className={`${criteria.meetsChange ? 'text-green-400' : 'text-slate-500'}`}>
                        {criteria.meetsChange ? '✓' : '✗'}
                      </span>
                    </div>
                  </td>

                  {/* News/Catalyst */}
                  <td className="px-3 py-3 text-center">
                    {stock.hasCatalyst ? (
                      <div className="flex items-center justify-center">
                        <span className="text-amber-400 text-lg">📰</span>
                        <span className="text-xs text-amber-400 ml-1">LIVE</span>
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

                  {/* Actions */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* UPDATED: Added click handler to L2 button */}
                      <button 
                        onClick={() => onShowLevel2(stock.ticker)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                        title={`Show Level 2 data for ${stock.ticker}`}
                      >
                        📊 L2
                      </button>
                      <button className="text-purple-400 hover:text-purple-300 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors">
                        📈 Chart
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* No stocks message */}
      {stocks.length === 0 && !isLoading && (
        <div className="text-center py-75">
          <div className="text-slate-400 mb-2">🔍 No stocks found</div>
          <div className="text-slate-500 text-sm">Start scanning to find momentum opportunities</div>
        </div>
      )}
    </div>
  );
};

export default Watchlist;