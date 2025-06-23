import { NextResponse } from 'next/server';
import { fetchLevel2Data } from '../../lib/polygon';

export async function POST(request: Request) {
  try {
    const { tickers } = await request.json();
    
    if (!tickers || !Array.isArray(tickers)) {
      return NextResponse.json({ error: 'Invalid tickers array' }, { status: 400 });
    }
    
    const data = await fetchLevel2Data(tickers);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Level 2 API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch level 2 data' }, { status: 500 });
  }
}