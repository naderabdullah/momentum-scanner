// src/app/components/scanner/Watchlist.tsx
import React from 'react';
import { Stock } from '../../lib/types';
import { formatNumber } from '../../lib/utils';

interface WatchlistProps {
  stocks: Stock[];
  isLoading: boolean;
}

const Watchlist: React.FC<WatchlistProps> = ({ stocks, isLoading }) => {
  const renderBody = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={10} className="text-center py-16 text-slate-500">
            <div className="flex justify-center items-center h-full">
              <div className="loader"></div>
            </div>
            <p className="mt-4">Connecting to live stream...</p>
          </td>
        </tr>
      );
    }

    if (stocks.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="text-center py-16 text-slate-500">
            No high-momentum stocks detected. Start scanning to see real-time data.
          </td>
        </tr>
      );
    }

    return stocks.map(stock => {
      const changeClass = stock.todaysChange > 0 ? 'text-green-400' : 'text-red-400';
      const scoreClass = stock.buy_score >= 70 ? 'high' : stock.buy_score >= 40 ? 'medium' : 'low';
      
      // Criteria indicators
      const meetsRelVol = stock.relVol >= 5;
      const meetsChange = stock.todaysChangePerc >= 10;
      const meetsFloat = stock.float > 0 && stock.float <= 50000000; // 50M
      const meetsPrice = stock.price >= 2 && stock.price <= 20;
      const hasCatalyst = stock.hasCatalyst;

      return (
        <tr key={stock.ticker} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
          <td className="px-3 py-2 font-bold text-cyan-400">{stock.ticker}</td>
          <td className="px-3 py-2">${stock.price.toFixed(2)}</td>
          <td className={`px-3 py-2 font-semibold ${changeClass}`}>
            {stock.todaysChangePerc > 0 ? '+' : ''}{stock.todaysChangePerc.toFixed(1)}%
            {meetsChange && <span className="ml-1 text-green-500">✓</span>}
          </td>
          <td className="px-3 py-2">
            <span className={meetsRelVol ? 'text-green-400 font-semibold' : ''}>
              {stock.relVol.toFixed(1)}x
              {meetsRelVol && <span className="ml-1 text-green-500">✓</span>}
            </span>
          </td>
          <td className="px-3 py-2">
            <span className={meetsFloat ? 'text-green-400' : ''}>
              {formatNumber(stock.float)}
              {meetsFloat && <span className="ml-1 text-green-500">✓</span>}
            </span>
          </td>
          <td className="px-3 py-2">
            <span className={meetsPrice ? 'text-green-400' : 'text-slate-500'}>
              {meetsPrice ? '✓' : '✗'}
            </span>
          </td>
          <td className="px-3 py-2">
            <span className={hasCatalyst ? 'text-amber-400' : 'text-slate-600'}>
              {hasCatalyst ? '📰' : '-'}
            </span>
          </td>
          <td className="px-3 py-2">{formatNumber(stock.day.v)}</td>
          <td className="px-3 py-2">
            <span className={`buy-score ${scoreClass} px-2 py-1 rounded-md text-xs font-bold`}>
              {stock.buy_score.toFixed(0)}
            </span>
          </td>
          <td className="px-3 py-2 text-sm">
            <span className="text-cyan-500 hover:text-cyan-400 cursor-pointer">
              L2 →
            </span>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="lg:col-span-2 panel rounded-lg p-4 h-[calc(100vh-350px)] min-h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-cyan-400">🔥 Live Momentum Scanner</h2>
        <div className="text-xs text-slate-500">
          ✓ = Meets Criteria | Score = Buy Signal Strength
        </div>
      </div>
      
      <div className="overflow-auto flex-grow">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-cyan-300 uppercase bg-slate-800/50 sticky top-0">
            <tr>
              <th className="px-3 py-3">Symbol</th>
              <th className="px-3 py-3">Price</th>
              <th className="px-3 py-3">Change%</th>
              <th className="px-3 py-3">RelVol</th>
              <th className="px-3 py-3">Float</th>
              <th className="px-3 py-3">$2-20</th>
              <th className="px-3 py-3">News</th>
              <th className="px-3 py-3">Volume</th>
              <th className="px-3 py-3">Score</th>
              <th className="px-3 py-3">L2</th>
            </tr>
          </thead>
          <tbody className="font-mono">{renderBody()}</tbody>
        </table>
      </div>
      
      <div className="mt-2 text-xs text-slate-500 border-t border-slate-800 pt-2">
        <div className="flex justify-between">
          <span>Criteria: RelVol ≥5x | Change ≥10% | Float ≤50M | Price $2-20 | News Catalyst</span>
          <span className="text-cyan-400">Real-time WebSocket Feed</span>
        </div>
      </div>
    </div>
  );
};

export default Watchlist;