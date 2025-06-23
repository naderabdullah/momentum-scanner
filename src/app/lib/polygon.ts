// lib/polygon.ts
import { Level2Data } from './types';

const API_KEY = process.env.POLYGON_API_KEY;

const apiFetch = async (url: string) => {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`https://api.polygon.io${url}${separator}apiKey=${API_KEY}`);
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Polygon API Error: ${response.status}`);
  }
  return response.json();
};

export const fetchGainers = async () => {
  const data = await apiFetch('/v2/snapshot/locale/us/markets/stocks/gainers?');
  return data.tickers || [];
};

const detectPatterns = (df: {h: number}[], price: number) => {
    const patterns: {[key: string]: boolean} = {};
    if (df.length < 20) return patterns;
    const twentyDayHigh = df.slice(-20).reduce((max, bar) => Math.max(max, bar.h), 0);
    if (price >= twentyDayHigh) patterns['📈 Breakout'] = true;
    return patterns;
};

export const fetchStockDetails = async (ticker: string, maxFloat: number, minRelVol: number) => {
  try {
    const details = await apiFetch(`/v3/reference/tickers/${ticker}?`);
    const float = details.results?.share_class_shares_outstanding || 0;
    if (float > maxFloat) return null;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const prevDayData = await apiFetch(`/v1/open-close/${ticker}/${yesterday.toISOString().split('T')[0]}?adjusted=true`);
    const avgVolume = prevDayData.volume;
    const currentVolume = details.results?.market_cap ? details.results.market_cap / details.results.weighted_shares_outstanding * details.results.weighted_shares_outstanding : 0; // estimate
    const relVol = avgVolume > 0 ? (currentVolume || 0) / avgVolume : 0;

    if (relVol < minRelVol) return null;
    
    const news = await apiFetch(`/v1/news?tickers=${ticker}&limit=1`);
    const hasCatalyst = news && news.length > 0;
    
    const history = await apiFetch(`/v2/aggs/ticker/${ticker}/range/1/day/${new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]}/${new Date().toISOString().split('T')[0]}?sort=asc&limit=20`);
    const df = history.results || [];
    const currentPrice = details.results?.market_cap ? details.results.market_cap / details.results.weighted_shares_outstanding : 0
    const patterns = detectPatterns(df, currentPrice);

    return { float, relVol, hasCatalyst, patterns };
  } catch (e) {
    if (e instanceof Error) {
        console.warn(`Skipping ${ticker} due to error:`, e.message);
    } else {
        console.warn(`Skipping ${ticker} due to an unknown error.`);
    }
    return null;
  }
};

export const fetchLevel2Data = async (tickers: string[]): Promise<Level2Data[]> => {
    if (tickers.length === 0) return [];
    try {
        const promises = tickers.map(t => apiFetch(`/v3/quotes/${t}?`));
        const results = await Promise.all(promises.map(p => p.catch(e => e)));
        
        return results.filter(r => !(r instanceof Error) && r.results?.[0]).map(r => {
            const q = r.results[0];
            return {
                ticker: q.ticker,
                bid_price: q.bid_price,
                bid_size: q.bid_size,
                ask_price: q.ask_price,
                ask_size: q.ask_size
            };
        });
    } catch (e) {
        if (e instanceof Error) {
            console.error("Failed to fetch L2 data:", e.message);
        } else {
            console.error("Failed to fetch L2 data due to an unknown error.");
        }
        return [];
    }
};