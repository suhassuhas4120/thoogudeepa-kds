/**
 * High-Throughput Keyed Write Mutex
 * 
 * Provides seat-level microsecond serialization to eliminate race conditions
 * for concurrent scans on the same seat, while allowing all 16 seats, kitchen,
 * waiter, and manager operations to execute concurrently in parallel with zero lag.
 */

class KeyedWriteQueue {
  private queues: Map<string, Promise<void>> = new Map();

  async enqueueKey<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prevPromise = this.queues.get(key) || Promise.resolve();

    let resolveTask!: (val: T) => void;
    let rejectTask!: (err: any) => void;
    const taskPromise = new Promise<T>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    const nextPromise = prevPromise
      .then(async () => {
        try {
          const res = await task();
          resolveTask(res);
        } catch (err) {
          rejectTask(err);
        }
      })
      .catch((err) => {
        console.error(`[KeyedWriteQueue] Error on key ${key}:`, err);
      })
      .finally(() => {
        if (this.queues.get(key) === nextPromise) {
          this.queues.delete(key);
        }
      });

    this.queues.set(key, nextPromise);
    return taskPromise;
  }

  async enqueue<T>(task: () => Promise<T>, key = 'default'): Promise<T> {
    // If running in Postgres, concurrent tasks run in parallel across keys
    return this.enqueueKey(key, task);
  }
}

const globalForQueue = globalThis as unknown as {
  sqliteWriteQueue: KeyedWriteQueue | undefined;
};

export const sqliteWriteQueue =
  globalForQueue.sqliteWriteQueue ?? new KeyedWriteQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.sqliteWriteQueue = sqliteWriteQueue;
}
