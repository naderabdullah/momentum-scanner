// src/app/lib/pattern-recognition.ts
import { CandlestickData, DetectedPattern, PatternRecognizer } from './types';

export class AdvancedPatternRecognizer implements PatternRecognizer {
  private static instance: AdvancedPatternRecognizer;
  
  static getInstance(): AdvancedPatternRecognizer {
    if (!AdvancedPatternRecognizer.instance) {
      AdvancedPatternRecognizer.instance = new AdvancedPatternRecognizer();
    }
    return AdvancedPatternRecognizer.instance;
  }

  detectBullFlag(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 20) return null;
    
    const recent = candles.slice(-20);
    const flagStart = recent.slice(0, 10);
    const flagEnd = recent.slice(-10);
    
    // Look for strong upward move followed by sideways consolidation
    const strongMove = this.hasStrongUpwardMove(flagStart);
    const consolidation = this.hasSidewaysConsolidation(flagEnd);
    const volumeConfirmation = this.hasVolumeConfirmation(recent, 'bull_flag');
    
    if (strongMove && consolidation && volumeConfirmation) {
      const confidence = this.calculatePatternConfidence([strongMove, consolidation, volumeConfirmation]);
      return {
        name: 'Bull Flag',
        confidence,
        timeframe: '5m',
        detected_at: Date.now(),
        description: 'Strong upward move followed by consolidation - bullish continuation pattern'
      };
    }
    
    return null;
  }

  detectBearFlag(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 20) return null;
    
    const recent = candles.slice(-20);
    const flagStart = recent.slice(0, 10);
    const flagEnd = recent.slice(-10);
    
    const strongMove = this.hasStrongDownwardMove(flagStart);
    const consolidation = this.hasSidewaysConsolidation(flagEnd);
    const volumeConfirmation = this.hasVolumeConfirmation(recent, 'bear_flag');
    
    if (strongMove && consolidation && volumeConfirmation) {
      const confidence = this.calculatePatternConfidence([strongMove, consolidation, volumeConfirmation]);
      return {
        name: 'Bear Flag',
        confidence,
        timeframe: '5m',
        detected_at: Date.now(),
        description: 'Strong downward move followed by consolidation - bearish continuation pattern'
      };
    }
    
    return null;
  }

  detectBreakout(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 30) return null;
    
    const consolidationPeriod = candles.slice(-20, -5);
    const breakoutCandles = candles.slice(-5);
    
    if (consolidationPeriod.length === 0 || breakoutCandles.length === 0) return null;
    
    const { high, low } = this.calculatePriceRange(consolidationPeriod);
    const rangePercent = ((high - low) / low) * 100;
    
    // Look for tight consolidation (less than 5% range)
    if (rangePercent > 5) return null;
    
    const latestPrice = breakoutCandles[breakoutCandles.length - 1]?.close;
    if (!latestPrice) return null;
    
    const avgVolume = consolidationPeriod.reduce((sum, c) => sum + c.volume, 0) / consolidationPeriod.length;
    const breakoutVolume = breakoutCandles.reduce((sum, c) => sum + c.volume, 0) / breakoutCandles.length;
    const volumeRatio = breakoutVolume / avgVolume;
    
    if ((latestPrice > high || latestPrice < low) && volumeRatio > 1.5) {
      const direction = latestPrice > high ? 'Upward' : 'Downward';
      const confidence = this.calculateBreakoutConfidence(rangePercent, volumeRatio);
      
      return {
        name: `${direction} Breakout`,
        confidence,
        timeframe: '15m',
        detected_at: Date.now(),
        description: `${direction} breakout from consolidation with volume confirmation`
      };
    }
    
    return null;
  }

  detectDoubleBottom(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 50) return null;
    
    const lows = this.findLocalMinima(candles);
    if (lows.length < 2) return null;
    
    for (let i = 0; i < lows.length - 1; i++) {
      const firstLow = lows[i];
      const secondLow = lows[i + 1];
      
      if (!firstLow || !secondLow) continue;
      
      const lowDiff = Math.abs(firstLow.low - secondLow.low) / firstLow.low * 100;
      if (lowDiff > 2) continue;
      
      const betweenCandles = candles.slice(firstLow.index, secondLow.index);
      if (betweenCandles.length === 0) continue;
      
      const peak = Math.max(...betweenCandles.map(c => c.high));
      const neckline = Math.max(firstLow.low, secondLow.low) * 1.03; // 3% above lows
      
      if (peak > neckline) {
        const confidence = this.calculateDoublePatternConfidence(lowDiff, peak / neckline);
        return {
          name: 'Double Bottom',
          confidence,
          timeframe: '15m',
          detected_at: Date.now(),
          description: 'Double bottom pattern detected - potential reversal signal'
        };
      }
    }
    
    return null;
  }

  detectDoubleTop(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 50) return null;
    
    const highs = this.findLocalMaxima(candles);
    if (highs.length < 2) return null;
    
    for (let i = 0; i < highs.length - 1; i++) {
      const firstHigh = highs[i];
      const secondHigh = highs[i + 1];
      
      if (!firstHigh || !secondHigh) continue;
      
      const highDiff = Math.abs(firstHigh.high - secondHigh.high) / firstHigh.high * 100;
      if (highDiff > 2) continue;
      
      const betweenCandles = candles.slice(firstHigh.index, secondHigh.index);
      if (betweenCandles.length === 0) continue;
      
      const trough = Math.min(...betweenCandles.map(c => c.low));
      const neckline = Math.min(firstHigh.high, secondHigh.high) * 0.97; // 3% below highs
      
      if (trough < neckline) {
        const confidence = this.calculateDoublePatternConfidence(highDiff, neckline / trough);
        return {
          name: 'Double Top',
          confidence,
          timeframe: '15m',
          detected_at: Date.now(),
          description: 'Double top pattern detected - potential reversal signal'
        };
      }
    }
    
    return null;
  }

  detectTriangle(candles: CandlestickData[]): DetectedPattern | null {
    if (candles.length < 30) return null;
    
    const highs = this.findLocalMaxima(candles);
    const lows = this.findLocalMinima(candles);
    
    if (highs.length < 3 || lows.length < 3) return null;
    
    // Calculate trend lines
    const highTrend = this.calculateTrendLine(highs.slice(-3));
    const lowTrend = this.calculateTrendLine(lows.slice(-3));
    
    const ascending = lowTrend.slope > 0 && Math.abs(highTrend.slope) < 0.1;
    const descending = highTrend.slope < 0 && Math.abs(lowTrend.slope) < 0.1;
    const symmetrical = Math.abs(highTrend.slope + lowTrend.slope) < 0.1;
    
    if (ascending || descending || symmetrical) {
      const type = ascending ? 'Ascending' : descending ? 'Descending' : 'Symmetrical';
      const confidence = this.calculateTriangleConfidence(highTrend.r2, lowTrend.r2);
      
      return {
        name: `${type} Triangle`,
        confidence,
        timeframe: '15m',
        detected_at: Date.now(),
        description: `${type} triangle pattern - consolidation before breakout`
      };
    }
    
    return null;
  }

  // Helper methods
  private hasStrongUpwardMove(candles: CandlestickData[]): boolean {
    if (candles.length === 0) return false;
    const start = candles[0]?.close;
    const end = candles[candles.length - 1]?.close;
    if (!start || !end) return false;
    const change = (end - start) / start * 100;
    return change > 5; // 5% minimum upward move
  }

  private hasStrongDownwardMove(candles: CandlestickData[]): boolean {
    if (candles.length === 0) return false;
    const start = candles[0]?.close;
    const end = candles[candles.length - 1]?.close;
    if (!start || !end) return false;
    const change = (end - start) / start * 100;
    return change < -5; // 5% minimum downward move
  }

  private hasSidewaysConsolidation(candles: CandlestickData[]): boolean {
    if (candles.length === 0) return false;
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const range = (high - low) / low * 100;
    return range < 3; // Less than 3% range
  }

  private hasVolumeConfirmation(candles: CandlestickData[], patternType: string): boolean {
    if (candles.length === 0) return false;
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    const recentVolume = candles.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
    return recentVolume > avgVolume * 1.2; // 20% above average
  }

  private calculatePatternConfidence(factors: boolean[]): number {
    const trueCount = factors.filter(f => f).length;
    return Math.min(95, (trueCount / factors.length) * 100);
  }

  private calculatePriceRange(candles: CandlestickData[]) {
    return {
      high: Math.max(...candles.map(c => c.high)),
      low: Math.min(...candles.map(c => c.low))
    };
  }

  private calculateBreakoutConfidence(rangePercent: number, volumeRatio: number): number {
    const rangeScore = Math.max(0, 100 - rangePercent * 10); // Lower range = higher confidence
    const volumeScore = Math.min(100, volumeRatio * 20); // Higher volume = higher confidence
    return (rangeScore + volumeScore) / 2;
  }

  private calculateDoublePatternConfidence(priceDiff: number, ratio: number): number {
    const priceScore = Math.max(0, 100 - priceDiff * 25); // Lower difference = higher confidence
    const ratioScore = Math.min(100, ratio * 30); // Better ratio = higher confidence
    return (priceScore + ratioScore) / 2;
  }

  private calculateTriangleConfidence(highR2: number, lowR2: number): number {
    return (highR2 + lowR2) / 2 * 100;
  }

  private findLocalMinima(candles: CandlestickData[]): Array<{low: number, index: number}> {
    const minima: Array<{low: number, index: number}> = [];
    
    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];
      const before1 = candles[i - 1];
      const before2 = candles[i - 2];
      const after1 = candles[i + 1];
      const after2 = candles[i + 2];
      
      if (!current || !before1 || !before2 || !after1 || !after2) continue;
      
      if (current.low < before1.low && current.low < before2.low && 
          current.low < after1.low && current.low < after2.low) {
        minima.push({ low: current.low, index: i });
      }
    }
    
    return minima;
  }

  private findLocalMaxima(candles: CandlestickData[]): Array<{high: number, index: number}> {
    const maxima: Array<{high: number, index: number}> = [];
    
    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];
      const before1 = candles[i - 1];
      const before2 = candles[i - 2];
      const after1 = candles[i + 1];
      const after2 = candles[i + 2];
      
      if (!current || !before1 || !before2 || !after1 || !after2) continue;
      
      if (current.high > before1.high && current.high > before2.high && 
          current.high > after1.high && current.high > after2.high) {
        maxima.push({ high: current.high, index: i });
      }
    }
    
    return maxima;
  }

  private calculateTrendLine(points: Array<{high?: number, low?: number, index: number}>): {slope: number, r2: number} {
    if (points.length < 2) return { slope: 0, r2: 0 };
    
    const values = points.map(p => p.high || p.low || 0);
    const indices = points.map(p => p.index);
    
    const n = points.length;
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    // Removed unused sumY2 variable
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = values.reduce((sum, y, i) => {
      const predicted = slope * indices[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);
    
    return { slope, r2: Math.max(0, r2) };
  }

  // Public method to detect all patterns
  public detectAllPatterns(ticker: string, candles: CandlestickData[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    try {
      const bullFlag = this.detectBullFlag(candles);
      if (bullFlag) patterns.push(bullFlag);
      
      const bearFlag = this.detectBearFlag(candles);
      if (bearFlag) patterns.push(bearFlag);
      
      const breakout = this.detectBreakout(candles);
      if (breakout) patterns.push(breakout);
      
      const doubleBottom = this.detectDoubleBottom(candles);
      if (doubleBottom) patterns.push(doubleBottom);
      
      const doubleTop = this.detectDoubleTop(candles);
      if (doubleTop) patterns.push(doubleTop);
      
      const triangle = this.detectTriangle(candles);
      if (triangle) patterns.push(triangle);
    } catch (error) {
      console.error(`Pattern detection error for ${ticker}:`, error);
    }
    
    return patterns.filter(p => p.confidence > 65); // Only return high-confidence patterns
  }
}