/**
 * Inflow API client with rate limiting
 *
 * Requires environment variables:
 *   INFLOW_API_KEY - Bearer token
 *   INFLOW_COMPANY_ID - Company GUID
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;
/**
 * GET request to Inflow API
 */
export declare function get<T = unknown>(endpoint: string, params?: QueryParams): Promise<T>;
/**
 * PUT request to Inflow API
 */
export declare function put<T = unknown>(endpoint: string, body: unknown): Promise<T>;
/**
 * GET all items from a paginated endpoint
 */
export declare function getAll<T = unknown>(endpoint: string, params?: QueryParams): Promise<T[]>;
/**
 * GET a single item by ID
 */
export declare function getOne<T = unknown>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
