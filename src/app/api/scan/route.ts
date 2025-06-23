import { NextResponse } from 'next/server';
import { fetchMarketSnapshot, fetchStockDetails } from '../../lib/polygon';
import { ScanCriteria, Stock } from '../../lib/types';

// Updated interface to include prevDay
interface PolygonTicker {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  lastTrade?: { p: number };
  day: { c: number; v: number };
  prevDay?: { c: number; v: number };
}

export async function POST(request: Request) {
  try {
    const criteria: ScanCriteria = await request.json();
    const allTickers: PolygonTicker[] = await fetchMarketSnapshot();

    if (!allTickers || allTickers.length === 0) {
      return NextResponse.json({ stocks: [], message: 'Market snapshot is currently unavailable.' });
    }

    // Sort by dollar volume with prevDay fallback
    const activeTickers = allTickers
      .sort((a, b) => {
        const dollarVolumeA = (a.lastTrade?.p || a.day.c || a.prevDay?.c || 0) * (a.day.v || a.prevDay?.v || 0);
        const dollarVolumeB = (b.lastTrade?.p || b.day.c || b.prevDay?.c || 0) * (b.day.v || b.prevDay?.v || 0);
        return dollarVolumeB - dollarVolumeA;
      })
      .slice(0, 300);

    if (activeTickers.length === 0) {
      return NextResponse.json({ stocks: [], message: 'No actively traded stocks found to analyze.' });
    }

    // Process in batches to avoid rate limits
    const batchSize = 50;
    const validStocks: Stock[] = [];

    for (let i = 0; i < activeTickers.length; i += batchSize) {
      const batch = activeTickers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (candidate: PolygonTicker): Promise<Stock | null> => {
        // Use prevDay as fallback for pre-market
        const currentPrice = candidate.lastTrade?.p || candidate.day.c || candidate.prevDay?.c;
        
        if (!currentPrice || currentPrice <= 0) {
          return null;
        }

        const details = await fetchStockDetails(candidate.ticker, currentPrice);
        
        if (details) {
          const todaysVolume = candidate.day.v || candidate.prevDay?.v || 0;
          const todaysChangePerc = candidate.todaysChangePerc || 0;
          const relVol = details.prevDayVolume > 0 ? todaysVolume / details.prevDayVolume : 0;
          
          // Scoring logic with criteria bonuses (not hard requirements)
          let buyScore = (todaysChangePerc / 2) + (relVol * 3);

          // Heavy bonuses for meeting criteria
          if (currentPrice >= criteria.minPrice && currentPrice <= criteria.maxPrice) buyScore += 15;
          if (todaysChangePerc >= criteria.minChange) buyScore += 15;
          if (relVol >= criteria.minRelVol) buyScore += 15;
          if (details.float > 0 && details.float <= criteria.maxFloat) buyScore += 15;
          if (details.hasCatalyst) buyScore += 25;
          if (details.patterns['📈 Breakout']) buyScore += 15;

          const newStock: Stock = {
            ticker: candidate.ticker,
            price: currentPrice,
            todaysChange: candidate.todaysChange || 0,
            todaysChangePerc: todaysChangePerc,
            day: { v: todaysVolume },
            relVol: relVol,
            float: details.float,
            buy_score: Math.min(100, buyScore),
            hasCatalyst: details.hasCatalyst,
            patterns: details.patterns,
          };
          return newStock;
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      validStocks.push(...batchResults.filter((stock): stock is Stock => stock !== null));
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < activeTickers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Sort by final buy score
    const sortedStocks = validStocks.sort((a, b) => b.buy_score - a.buy_score).slice(0, 20);

    return NextResponse.json({ stocks: sortedStocks });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
  }
}