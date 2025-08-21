/**
 * Rate limiter for API requests with exponential backoff
 */
export class RateLimiter {
  private requestTimes: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private backoffUntil: number = 0;
  private consecutiveErrors: number = 0;

  constructor(maxRequests: number = 50, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if we can make a request now
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Check if we're in backoff period
    if (now < this.backoffUntil) {
      return false;
    }

    // Clean up old request times outside the window
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    
    // Check if we've hit the rate limit
    return this.requestTimes.length < this.maxRequests;
  }

  /**
   * Wait until we can make a request
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    
    // If in backoff period, wait
    if (now < this.backoffUntil) {
      const waitTime = this.backoffUntil - now;
      console.log(`⏳ Rate limit backoff: waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return;
    }

    // Clean up old request times
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    
    // If at rate limit, calculate wait time
    if (this.requestTimes.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = Math.max(0, this.windowMs - (now - oldestRequest) + 100); // Add 100ms buffer
      
      console.log(`⏳ Rate limit reached (${this.requestTimes.length}/${this.maxRequests}), waiting ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Clean up again after waiting
      this.requestTimes = this.requestTimes.filter(time => Date.now() - time < this.windowMs);
    }
  }

  /**
   * Record a successful request
   */
  recordRequest(): void {
    this.requestTimes.push(Date.now());
    this.consecutiveErrors = 0; // Reset error count on success
    console.log(`📊 Rate limit: ${this.requestTimes.length}/${this.maxRequests} requests in window`);
  }

  /**
   * Handle a 429 error with exponential backoff
   */
  handle429Error(): void {
    this.consecutiveErrors++;
    
    // Exponential backoff: 2^errors seconds, max 5 minutes
    const backoffSeconds = Math.min(Math.pow(2, this.consecutiveErrors), 300);
    this.backoffUntil = Date.now() + (backoffSeconds * 1000);
    
    console.error(`🚫 Rate limit hit! Backing off for ${backoffSeconds}s (attempt ${this.consecutiveErrors})`);
  }

  /**
   * Handle auth or server errors with longer backoff
   * @param statusCode The HTTP status code (401, 500, etc.)
   */
  handleServerError(statusCode: number): void {
    this.consecutiveErrors++;
    
    let backoffSeconds: number;
    if (statusCode === 401) {
      // Auth errors: longer backoff, max 10 minutes
      backoffSeconds = Math.min(Math.pow(2, this.consecutiveErrors + 1) * 2, 600);
      console.error(`🔐 Auth error! Backing off for ${backoffSeconds}s (attempt ${this.consecutiveErrors})`);
    } else if (statusCode === 500) {
      // Server errors: aggressive backoff, max 10 minutes
      backoffSeconds = Math.min(Math.pow(2, this.consecutiveErrors + 1) * 3, 600);
      console.error(`💥 Server error! Backing off for ${backoffSeconds}s (attempt ${this.consecutiveErrors})`);
    } else {
      // Other errors: standard backoff
      backoffSeconds = Math.min(Math.pow(2, this.consecutiveErrors), 120);
      console.error(`⚠️ Error ${statusCode}! Backing off for ${backoffSeconds}s (attempt ${this.consecutiveErrors})`);
    }
    
    this.backoffUntil = Date.now() + (backoffSeconds * 1000);
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requestTimes.length);
  }

  /**
   * Get time until next available slot (in ms)
   */
  getTimeUntilNextSlot(): number {
    const now = Date.now();
    
    // If in backoff, return backoff time
    if (now < this.backoffUntil) {
      return this.backoffUntil - now;
    }
    
    // Clean up old requests
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    
    // If under limit, no wait
    if (this.requestTimes.length < this.maxRequests) {
      return 0;
    }
    
    // Calculate wait time until oldest request expires
    const oldestRequest = Math.min(...this.requestTimes);
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requestTimes = [];
    this.backoffUntil = 0;
    this.consecutiveErrors = 0;
  }
}

// Singleton instance for Perplexity API
export const perplexityRateLimiter = new RateLimiter(50, 60000);