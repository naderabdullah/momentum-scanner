// lib/utils.ts
export const formatNumber = (num: number | null): string => {
    if (num === null || typeof num === 'undefined') return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

export const parseHumanFloat = (str: string): number => {
    if (!str) return 0;
    const s = str.toLowerCase().trim();
    const num = parseFloat(s);
    if (s.endsWith('b')) return num * 1e9;
    if (s.endsWith('m')) return num * 1e6;
    if (s.endsWith('k')) return num * 1e3;
    return parseInt(s, 10) || 0;
};