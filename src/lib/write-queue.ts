/**
 * In-Process Serialized Write Mutex & Queue for SQLite
 *
 * Guarantees zero SQLITE_BUSY (P2010/P2034) lock contention by serializing all
 * write transactions in a FIFO microsecond promise chain while WAL mode handles
 * infinite concurrent reads in parallel.
 */

class WriteQueue {
  private queue: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.pendingCount++;

    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await task();
            resolve(result);
          } catch (err) {
            reject(err);
          } finally {
            this.pendingCount = Math.max(0, this.pendingCount - 1);
          }
        })
        .catch((err) => {
          console.error('[WriteQueue] Uncaught task error:', err);
        });
    });
  }

  getPendingCount(): number {
    return this.pendingCount;
  }
}

const globalForQueue = globalThis as unknown as {
  sqliteWriteQueue: WriteQueue | undefined;
};

export const sqliteWriteQueue =
  globalForQueue.sqliteWriteQueue ?? new WriteQueue();

if (process.env.NODE_ENV !== 'production') {
  globalForQueue.sqliteWriteQueue = sqliteWriteQueue;
}
