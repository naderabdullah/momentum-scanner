import { NextResponse } from 'next/server';
import { fetchMarketSnapshot, fetchStockDetails } from '../../lib/polygon';
import { ScanCriteria, Stock } from '../../lib/types';

// Define a type for the objects from the Polygon snapshot endpoint
interface PolygonTicker {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  lastTrade?: { p: number };
  day: { c: number; v: number };
}

export async function POST(request: Request) {
  try {
    const criteria: ScanCriteria = await request.json();
    const allTickers: PolygonTicker[] = await fetchMarketSnapshot();

    // If the market snapshot is empty, return immediately.
    if (!allTickers || allTickers.length === 0) {
      return NextResponse.json({ stocks: [], message: 'Market snapshot is currently unavailable.' });
    }

    // Sort all tickers by dollar volume to find the most active ones.
    // This is more robust for all market conditions (pre-market, regular hours).
    const activeTickers = allTickers
      .sort((a, b) => {
        const dollarVolumeA = (a.lastTrade?.p || a.day.c || 0) * (a.day.v || 0);
        const dollarVolumeB = (b.lastTrade?.p || b.day.c || 0) * (b.day.v || 0);
        return dollarVolumeB - dollarVolumeA;
      })
      .slice(0, 300); // Take the top 300 most active stocks for detailed analysis

    if (activeTickers.length === 0) {
      return NextResponse.json({ stocks: [], message: 'No actively traded stocks found to analyze.' });
    }
    
    // Process the top active stocks in parallel
    const processedStockPromises = activeTickers.map(async (candidate: PolygonTicker): Promise<Stock | null> => {
      const currentPrice = candidate.lastTrade?.p || candidate.day.c;
      if (!currentPrice || currentPrice <= 0) return null;

      const details = await fetchStockDetails(candidate.ticker, currentPrice);
      
      if (details) {
        const todaysVolume = candidate.day.v || 0;
        const todaysChangePerc = candidate.todaysChangePerc || 0;
        const relVol = details.prevDayVolume > 0 ? todaysVolume / details.prevDayVolume : 0;
        
        // Scoring logic remains the same, rewarding stocks that fit the criteria
        let buyScore = (todaysChangePerc / 2) + (relVol * 3);

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

    const processedStocksResults = await Promise.all(processedStockPromises);
    const validStocks = processedStocksResults.filter((stock): stock is Stock => stock !== null);

    // Sort by final buy score to find the "best available" setups
    const sortedStocks = validStocks.sort((a, b) => b.buy_score - a.buy_score).slice(0, 20);

    return NextResponse.json({ stocks: sortedStocks });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
  }
}
