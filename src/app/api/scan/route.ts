import { NextResponse } from 'next/server';
import { fetchGainers, fetchStockDetails } from '../../lib/polygon';
import { ScanCriteria } from '../../lib/types';

export async function POST(request: Request) {
  try {
    const criteria: ScanCriteria = await request.json();
    const gainers = await fetchGainers();

    const candidates = [];
    for (const gainer of gainers) {
      const currentPrice = gainer.lastTrade?.p || gainer.day.c;
      if (gainer.todaysChangePerc >= criteria.minChange && currentPrice >= criteria.minPrice && currentPrice <= criteria.maxPrice) {
        candidates.push(gainer);
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ stocks: [], message: 'No stocks met initial price/change criteria.' });
    }

    const filteredStocks = [];
    for (const candidate of candidates.slice(0, 50)) { // Process up to 50 candidates
      const details = await fetchStockDetails(candidate.ticker, criteria.maxFloat, criteria.minRelVol);
      if (details) {
        const buyScore = (candidate.todaysChangePerc) + (details.relVol * 2) + (details.hasCatalyst ? 25 : 0) + (details.patterns['📈 Breakout'] ? 15 : 0);
        
        filteredStocks.push({
          ...candidate,
          ...details,
          buy_score: Math.min(100, buyScore),
          price: candidate.lastTrade?.p || candidate.day.c,
        });
      }
    }

    const sortedStocks = filteredStocks.sort((a, b) => b.buy_score - a.buy_score).slice(0, 20);

    return NextResponse.json({ stocks: sortedStocks });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, { status: 500 });
  }
}
