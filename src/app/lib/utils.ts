// src/app/lib/utils.ts

/**
 * Parse human-readable float values like "20M", "5.5B", "100K" to actual numbers
 */
export const parseHumanFloat = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(numericValue)) return 0;
  
  const multiplier = value.toUpperCase();
  
  if (multiplier.includes('B')) {
    return numericValue * 1000000000; // Billion
  } else if (multiplier.includes('M')) {
    return numericValue * 1000000; // Million
  } else if (multiplier.includes('K')) {
    return numericValue * 1000; // Thousand
  }
  
  return numericValue;
};

/**
 * Format numbers for human-readable display
 */
export const formatHumanNumber = (num: number): string => {
  if (num >= 1000000000) {
    return `${(num / 1000000000).toFixed(1)}B`;
  } else if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

/**
 * Format percentage with appropriate precision and sign
 */
export const formatPercentage = (value: number, precision: number = 1): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(precision)}%`;
};

/**
 * Format price with appropriate decimal places
 */
export const formatPrice = (price: number): string => {
  if (price >= 100) {
    return price.toFixed(2);
  } else if (price >= 10) {
    return price.toFixed(3);
  } else if (price >= 1) {
    return price.toFixed(4);
  } else {
    return price.toFixed(6);
  }
};

/**
 * Format currency with dollar sign
 */
export const formatCurrency = (amount: number): string => {
  return `$${formatPrice(amount)}`;
};

/**
 * Calculate relative volume ratio
 */
export const calculateRelativeVolume = (currentVolume: number, averageVolume: number): number => {
  if (averageVolume === 0) return 0;
  return currentVolume / averageVolume;
};

/**
 * Calculate price change percentage
 */
export const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

/**
 * Determine if a stock meets the enhanced buy criteria
 */
export const checkBuyCriteria = (stock: {
  relVol: number;
  todaysChangePerc: number;
  float: number;
  price: number;
  hasCatalyst: boolean;
}) => {
  return {
    meetsRelVol: stock.relVol >= 5,
    meetsChange: Math.abs(stock.todaysChangePerc) >= 10,
    meetsFloat: stock.float <= 20000000, // 20M shares
    meetsPrice: stock.price >= 2 && stock.price <= 20,
    hasCatalyst: stock.hasCatalyst
  };
};

/**
 * Local storage helpers with error handling
 */
export const storage = {
  get: <T>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  
  set: (key: string, value: unknown): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },
  
  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }
};

/**
 * Calculate buy score based on weighted criteria
 */
export const calculateBuyScore = (stock: {
  relVol: number;
  todaysChangePerc: number;
  float: number;
  price: number;
  hasCatalyst: boolean;
  patterns?: string[];
  volumeSurge?: boolean;
}): number => {
  let score = 0;
  
  // Relative Volume Score (30% weight, target: >5x)
  const relVolScore = Math.min(100, (stock.relVol / 5) * 100);
  score += relVolScore * 0.30;
  
  // Price Change Score (25% weight, target: >10%)
  const priceChangeScore = Math.min(100, (Math.abs(stock.todaysChangePerc) / 10) * 100);
  score += priceChangeScore * 0.25;
  
  // Float Score (20% weight, target: <20M, preference for smaller)
  const floatScore = stock.float < 20000000 ? 
    Math.max(0, 100 - (stock.float / 20000000) * 100) : 0;
  score += floatScore * 0.20;
  
  // Price Range Score (10% weight, target: $2-$20)
  const priceRangeScore = (stock.price >= 2 && stock.price <= 20) ? 100 : 0;
  score += priceRangeScore * 0.10;
  
  // News Catalyst Score (10% weight)
  const newsScore = stock.hasCatalyst ? 100 : 0;
  score += newsScore * 0.10;
  
  // Pattern Score (3% weight)
  const patternScore = stock.patterns && stock.patterns.length > 0 ? 100 : 0;
  score += patternScore * 0.03;
  
  // Volume Surge Score (2% weight)
  const volumeSurgeScore = stock.volumeSurge ? 100 : 0;
  score += volumeSurgeScore * 0.02;
  
  return Math.min(100, Math.max(0, score));
};

/**
 * Enhanced buy score calculation with additional parameters
 */
export const calculateEnhancedBuyScore = (
  relVol: number,
  changePerc: number,
  price: number,
  float: number,
  hasCatalyst: boolean,
  patterns: string[],
  volumeSurge: boolean
): number => {
  return calculateBuyScore({
    relVol,
    todaysChangePerc: changePerc,
    price,
    float,
    hasCatalyst,
    patterns,
    volumeSurge
  });
};

/**
 * Get color class based on buy score
 */
export const getBuyScoreColor = (score: number): string => {
  if (score >= 90) return 'text-green-400';
  if (score >= 75) return 'text-amber-400';
  if (score >= 60) return 'text-blue-400';
  return 'text-slate-400';
};

/**
 * Get buy signal text based on score
 */
export const getBuySignalText = (score: number): string => {
  if (score >= 95) return 'STRONG BUY';
  if (score >= 85) return 'BUY';
  if (score >= 75) return 'WATCH';
  if (score >= 60) return 'MONITOR';
  return 'NEUTRAL';
};

/**
 * Validate float string input
 */
export const validateFloatInput = (input: string): boolean => {
  const validPattern = /^\d+(\.\d+)?[KMB]?$/i;
  return validPattern.test(input.trim());
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Calculate moving average
 */
export const calculateMovingAverage = (values: number[], period: number): number[] => {
  if (values.length < period) return [];
  
  const result: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  
  return result;
};

/**
 * Calculate standard deviation
 */
export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / values.length;
  
  return Math.sqrt(variance);
};

/**
 * Safe JSON parse with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

/**
 * Format volume for display
 */
export const formatVolume = (volume: number): string => {
  return formatHumanNumber(volume);
};

/**
 * Calculate percentage difference between two values
 */
export const calculatePercentDifference = (value1: number, value2: number): number => {
  if (value2 === 0) return 0;
  return Math.abs((value1 - value2) / value2) * 100;
};

/**
 * Check if a value is within a percentage range of another value
 */
export const isWithinRange = (value: number, target: number, tolerancePercent: number): boolean => {
  const tolerance = target * (tolerancePercent / 100);
  return Math.abs(value - target) <= tolerance;
};

/**
 * Round to specified decimal places
 */
export const roundToDecimal = (value: number, decimals: number): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};