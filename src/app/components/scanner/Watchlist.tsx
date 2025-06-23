// components/scanner/Watchlist.tsx
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
          <td colSpan={7} className="text-center py-16 text-slate-500">
             <div className="flex justify-center items-center h-full"><div className="loader"></div></div>
             <p className="mt-4">Scanning for matching stocks...</p>
          </td>
        </tr>
      );
    }
    // Updated message for when no stocks are returned
    if (stocks.length === 0) {
      return <tr><td colSpan={7} className="text-center py-16 text-slate-500">No high-momentum stocks found. Try again later.</td></tr>;
    }
    return stocks.map(stock => {
      const changeClass = stock.todaysChange > 0 ? 'text-green-400' : 'text-red-400';
      const scoreClass = stock.buy_score >= 70 ? 'high' : stock.buy_score >= 40 ? 'medium' : 'low';
      const icons = Object.keys(stock.patterns).join(' ');
      return (
        <tr key={stock.ticker} className="border-b border-slate-800 hover:bg-slate-800/50">
          <td className="px-4 py-3 font-bold text-cyan-400">{stock.ticker}</td>
          <td className="px-4 py-3">${stock.price.toFixed(2)}</td>
          <td className={`px-4 py-3 ${changeClass}`}>{stock.todaysChangePerc.toFixed(1)}%</td>
          <td className="px-4 py-3">{stock.relVol.toFixed(1)}x</td>
          <td className="px-4 py-3">{formatNumber(stock.float)}</td>
          <td className="px-4 py-3"><span className={`buy-score ${scoreClass} px-2 py-1 rounded-md text-xs font-bold`}>{stock.buy_score.toFixed(0)}</span></td>
          <td className="px-4 py-3 text-lg">{icons}</td>
        </tr>
      );
    });
  };

  return (
    <div className="lg:col-span-2 panel rounded-lg p-4 h-[calc(100vh-350px)] min-h-[400px] flex flex-col">
      <h2 className="text-xl font-bold text-cyan-400 mb-4">🔥 Top 20 Momentum Watchlist</h2>
      <div className="overflow-auto flex-grow">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-cyan-300 uppercase bg-slate-800/50 sticky top-0">
            <tr>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Change%</th>
              <th className="px-4 py-3">RelVol</th>
              <th className="px-4 py-3">Float</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Catalyst/Pattern</th>
            </tr>
          </thead>
          <tbody className="font-mono">{renderBody()}</tbody>
        </table>
      </div>
    </div>
  );
};

export default Watchlist;
