/**
 * Inflow API client with rate limiting
 */

const BASE_URL = 'https://cloudapi.inflowinventory.com';
const API_VERSION = '2025-06-24';
const RATE_LIMIT_DELAY = 1200; // 1.2s = 50 req/min (safe margin under 60/min)
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 60000; // 60s default if no Retry-After header
const WINDOW_LIMIT_THRESHOLD = 50; // Pause when this many requests remain in window
const WINDOW_RESET_WAIT = 300000; // 5 minutes - conservative wait for window reset

// ============================================================================
// Types
// ============================================================================

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

interface PaginatedResponse<T> {
  value?: T[];
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an Inflow API client with explicit configuration.
 * Fails fast with clear error messages if config is invalid.
 */
export function createClient(config: InflowClientConfig): InflowClient {
  if (!config.apiKey) {
    throw new Error('apiKey is required - get your API key from Inflow Settings > API');
  }
  if (!config.companyId) {
    throw new Error('companyId is required - get your Company ID from Inflow Settings > API');
  }

  const { apiKey, companyId } = config;
  let lastRequestTime = 0;

  function parseRetryAfter(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) return DEFAULT_RETRY_DELAY;

    // Could be seconds or a date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000; // Convert to ms
    }

    // Try parsing as date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      return Math.max(0, date.getTime() - Date.now());
    }

    return DEFAULT_RETRY_DELAY;
  }

  async function rateLimitedFetch(url: URL, options: RequestInit, retryCount = 0): Promise<Response> {
    const now = Date.now();
    const elapsed = now - lastRequestTime;

    if (elapsed < RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
    }

    lastRequestTime = Date.now();
    const response = await fetch(url, options);

    // Handle rate limiting with retry
    if (response.status === 429) {
      if (retryCount >= MAX_RETRIES) {
        return response; // Let caller handle the error
      }

      const retryDelay = parseRetryAfter(response);
      console.warn(`Rate limited (429). Waiting ${Math.round(retryDelay / 1000)}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      return rateLimitedFetch(url, options, retryCount + 1);
    }

    // Proactively check window rate limit to avoid hitting 429s
    const windowLimit = response.headers.get('x-ratelimit-limit');
    if (windowLimit) {
      const match = windowLimit.match(/(\d+)\/(\d+)/);
      if (match) {
        const used = parseInt(match[1], 10);
        const max = parseInt(match[2], 10);
        const remaining = max - used;

        if (remaining <= WINDOW_LIMIT_THRESHOLD) {
          const waitMinutes = Math.round(WINDOW_RESET_WAIT / 60000);
          console.warn(`Approaching window rate limit (${used}/${max}, ${remaining} remaining). Pausing ${waitMinutes} minutes for reset...`);
          await new Promise(resolve => setTimeout(resolve, WINDOW_RESET_WAIT));
        }
      }
    }

    return response;
  }

  async function clientGet<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T> {
    const url = new URL(`${BASE_URL}/${companyId}${endpoint}`);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': `application/json;version=${API_VERSION}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API GET ${endpoint} failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async function clientPut<T = unknown>(endpoint: string, body: unknown): Promise<T> {
    const url = new URL(`${BASE_URL}/${companyId}${endpoint}`);

    const response = await rateLimitedFetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': `application/json;version=${API_VERSION}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API PUT ${endpoint} failed (${response.status}): ${text}`);
    }

    const text = await response.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  function extractId(item: unknown): string | null {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      if (key.endsWith('Id') && typeof obj[key] === 'string') {
        return obj[key] as string;
      }
    }
    return null;
  }

  async function clientGetAll<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T[]> {
    const items: T[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    const top = 100;
    let page = 1;

    while (true) {
      console.log(`  Fetching ${endpoint} page ${page} (skip=${skip})...`);

      const response = await clientGet<T[] | PaginatedResponse<T> | T>(endpoint, {
        ...params,
        top,
        skip,
      });

      let data: T[];
      if (Array.isArray(response)) {
        data = response;
      } else if (response && typeof response === 'object' && 'value' in response && Array.isArray(response.value)) {
        data = response.value;
      } else {
        console.log(`  Fetched 1 record from ${endpoint}`);
        return [response as T];
      }

      if (data.length === 0) {
        console.log(`  Completed ${endpoint}: ${items.length} total records`);
        break;
      }

      let newCount = 0;
      for (const item of data) {
        const id = extractId(item);
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          items.push(item);
          newCount++;
        }
      }

      if (newCount === 0) {
        console.log(`  Completed ${endpoint}: ${items.length} total records (no new items)`);
        break;
      }

      skip += data.length;
      page++;
    }

    return items;
  }

  async function clientGetOne<T = unknown>(endpoint: string, id: string, params: QueryParams = {}): Promise<T> {
    return clientGet<T>(`${endpoint}/${id}`, params);
  }

  return {
    get: clientGet,
    getAll: clientGetAll,
    getOne: clientGetOne,
    put: clientPut,
  };
}

// ============================================================================
// Legacy bare functions (backwards compatibility)
// Uses environment variables: INFLOW_API_KEY, INFLOW_COMPANY_ID
// ============================================================================

function getEnvConfig(): InflowClientConfig {
  const apiKey = process.env.INFLOW_API_KEY;
  const companyId = process.env.INFLOW_COMPANY_ID;

  if (!apiKey || !companyId) {
    throw new Error('Missing INFLOW_API_KEY or INFLOW_COMPANY_ID environment variables');
  }

  return { apiKey, companyId };
}

let defaultClient: InflowClient | null = null;

function getDefaultClient(): InflowClient {
  if (!defaultClient) {
    defaultClient = createClient(getEnvConfig());
  }
  return defaultClient;
}

/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function get<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T> {
  return getDefaultClient().get<T>(endpoint, params);
}

/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function getAll<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T[]> {
  return getDefaultClient().getAll<T>(endpoint, params);
}

/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function getOne<T = unknown>(endpoint: string, id: string, params: QueryParams = {}): Promise<T> {
  return getDefaultClient().getOne<T>(endpoint, id, params);
}

/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function put<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  return getDefaultClient().put<T>(endpoint, body);
}
