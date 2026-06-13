/**
 * Utility functions for batching operations to improve performance and reduce battery drain
 */

/**
 * Debounce function calls - delays execution until after wait time has passed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls - limits execution to at most once per wait time
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
  };
}

/**
 * Batch multiple operations together
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processor: (items: T[]) => Promise<void>;
  private batchSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    processor: (items: T[]) => Promise<void>,
    batchSize: number = 10,
    flushInterval: number = 1000
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
  }

  add(item: T) {
    this.queue.push(item);

    // Flush if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      // Schedule flush after interval
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flush();
        }, this.flushInterval);
      }
    }
  }

  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const items = [...this.queue];
    this.queue = [];

    try {
      await this.processor(items);
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-queue items on error (optional)
    }
  }

  getQueueSize() {
    return this.queue.length;
  }
}

/**
 * Batch database queries together
 */
export async function batchQueries<T>(
  queries: (() => Promise<T>)[],
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(query => query()));
    results.push(...batchResults);
  }

  return results;
}
