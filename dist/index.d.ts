/**
 * Inflow API client with rate limiting
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;
export interface RateLimitPauseInfo {
    remaining: number;
    used: number;
    max: number;
    waitMs: number;
    requestsToRecover: number;
}
export interface RateLimitConfig {
    /** Pause when this many requests remain in window. Default: 20 */
    windowThreshold?: number;
    /** Sliding window duration in ms. Default: 3600000 (1 hour) */
    windowDurationMs?: number;
    /** Wait until this many requests age out before resuming. Default: 50 */
    bufferRequests?: number;
    /** Callback when rate limit pause occurs */
    onRateLimitPause?: (info: RateLimitPauseInfo) => void;
}
export interface InflowClientConfig {
    apiKey: string;
    companyId: string;
    rateLimitConfig?: RateLimitConfig;
}
export interface GetAllOptions {
    /** Stop fetching after collecting this many items */
    limit?: number;
}
export interface InflowClient {
    get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T>;
    getAll<T = unknown>(endpoint: string, params?: QueryParams, options?: GetAllOptions): Promise<T[]>;
    getOne<T = unknown>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
    put<T = unknown>(endpoint: string, body: unknown): Promise<T>;
}
/**
 * Create an Inflow API client with explicit configuration.
 * Fails fast with clear error messages if config is invalid.
 */
export declare function createClient(config: InflowClientConfig): InflowClient;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T>;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function getAll<T = unknown>(endpoint: string, params?: QueryParams, options?: GetAllOptions): Promise<T[]>;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function getOne<T = unknown>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function put<T = unknown>(endpoint: string, body: unknown): Promise<T>;
