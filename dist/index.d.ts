/**
 * Inflow API client with rate limiting
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;
export interface InflowClientConfig {
    apiKey: string;
    companyId: string;
}
export interface InflowClient {
    get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T>;
    getAll<T = unknown>(endpoint: string, params?: QueryParams): Promise<T[]>;
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
export declare function getAll<T = unknown>(endpoint: string, params?: QueryParams): Promise<T[]>;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function getOne<T = unknown>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export declare function put<T = unknown>(endpoint: string, body: unknown): Promise<T>;
