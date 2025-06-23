// lib/polygon.ts
import { Level2Data } from './types';

const API_KEY = process.env.POLYGON_API_KEY;

// Helper function for fetching data from Polygon API
const apiFetch = async (url: string) => {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`https://api.polygon.io${url}${separator}apiKey=${API_KEY}`);
  
  // Add debugging
  const responseText = await response.text();
  console.log('Polygon response:', responseText.substring(0, 100));
  
  if (!response.ok) {
    throw new Error(`Polygon API Error: ${response.status} - ${responseText}`);
  }
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON response from Polygon: ${responseText.substring(0, 100)}`);
  }
};

/**
 * Fetches a snapshot of the entire market to get a broad list of active stocks.
 * This replaces the previous `fetchGainers` to look for setups market-wide.
 */
export const fetchMarketSnapshot = async () => {
  const data = await apiFetch('/v2/snapshot/locale/us/markets/stocks/tickers?');
  return data.tickers || [];
};

// Detects simple chart patterns like a 20-day breakout
const detectPatterns = (df: {h: number}[], price: number) => {
    const patterns: {[key: string]: boolean} = {};
    if (df.length < 20) return patterns;
    // Find the highest high over the last 20 days
    const twentyDayHigh = df.slice(-20).reduce((max, bar) => Math.max(max, bar.h), 0);
    if (price >= twentyDayHigh) {
        patterns['📈 Breakout'] = true;
    }
    return patterns;
};

/**
 * Fetches supplementary details for a stock needed for scoring.
 * This is now more efficient, running API calls concurrently.
 * @param ticker The stock ticker.
 * @param currentPrice The current price, passed in for accurate pattern detection.
 * @returns An object with float, previous day's volume, catalyst info, and patterns, or null on error.
 */
export const fetchStockDetails = async (ticker: string, currentPrice: number) => {
  try {
    const today = new Date();
    // Set date range for historical data fetch
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Run API calls in parallel to speed up data retrieval
    const [detailsRes, prevDayRes, newsRes, historyRes] = await Promise.all([
      apiFetch(`/v3/reference/tickers/${ticker}?`),
      apiFetch(`/v2/aggs/ticker/${ticker}/prev?adjusted=true`),
      apiFetch(`/v2/reference/news?ticker=${ticker}`),
      apiFetch(`/v2/aggs/ticker/${ticker}/range/1/day/${thirtyDaysAgo}/${todayStr}?sort=asc&limit=20`)
    ]);

    const float = detailsRes.results?.share_class_shares_outstanding || 0;
    const prevDayVolume = prevDayRes.results?.[0]?.v || 0;
    const hasCatalyst = newsRes.results && newsRes.results.length > 0;
    const patterns = detectPatterns(historyRes.results || [], currentPrice);

    return { float, prevDayVolume, hasCatalyst, patterns };
  } catch (e) {
    if (e instanceof Error) {
        console.warn(`Skipping ${ticker} due to error:`, e.message);
    } else {
        console.warn(`Skipping ${ticker} due to an unknown error.`);
    }
    return null;
  }
};

// Fetches Level 2 order book data
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
