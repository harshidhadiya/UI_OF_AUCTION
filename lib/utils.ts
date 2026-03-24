'use client';

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a number as Indian Rupee currency string
 */
export function formatCurrency(n: number): string {
  return `₹${(n ?? 0).toLocaleString('en-IN')}`;
}

/**
 * Get a human-readable relative date string (e.g. "in 2 days", "3 hours ago")
 */
export function getRelativeDateText(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (days > 0) return isFuture ? `in ${days}d ${hours % 24}h` : `${days}d ago`;
  if (hours > 0) return isFuture ? `in ${hours}h ${minutes % 60}m` : `${hours}h ago`;
  if (minutes > 0) return isFuture ? `in ${minutes}m` : `${minutes}m ago`;
  return isFuture ? 'starts soon' : 'just now';
}
