/**
 * ApiQueue - Rate-limited API request queue
 * 
 * Respects TheSportsDB free-tier limit of 25 calls per minute.
 * All calls to TheSportsDB must pass through this queue.
 * 
 * Usage:
 *   const apiQueue = new ApiQueue(25); // 25 calls per minute
 *   const result = await apiQueue.add(() => fetch(url));
 */

class ApiQueue {
  constructor(maxPerMinute = 25) {
    this.interval = 60000 / maxPerMinute; // ~2.4s per call for 25/min
    this.queue = [];
    this.lastCall = 0;
    this.processing = false;
  }

  /**
   * Add a function to the queue and return a Promise that resolves with its result
   * @param {Function} fn - Async function to execute
   * @returns {Promise} - Resolves with the function's result
   */
  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  /**
   * Process the queue sequentially with rate limiting
   */
  async process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length) {
      const now = Date.now();
      const wait = Math.max(0, this.lastCall + this.interval - now);
      if (wait) await new Promise(r => setTimeout(r, wait));
      
      const { fn, resolve, reject } = this.queue.shift();
      try {
        const result = await fn();
        resolve(result);
      } catch (e) {
        // Handle 429 (Too Many Requests) with exponential backoff
        if (e.response && e.response.status === 429) {
          console.error("[ApiQueue] Rate limit hit. Sleeping for 60s.");
          await new Promise(r => setTimeout(r, 60000));
          // Re-queue the failed request for retry
          this.queue.unshift({ fn, resolve, reject });
        } else {
          reject(e);
        }
      }
      this.lastCall = Date.now();
    }
    
    this.processing = false;
  }

  /**
   * Get current queue length (useful for monitoring)
   */
  getQueueLength() {
    return this.queue.length;
  }
}

// Export singleton instance for TheSportsDB (25 calls/min)
const apiQueue = new ApiQueue(25);

module.exports = { ApiQueue, apiQueue };
