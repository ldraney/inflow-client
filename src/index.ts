/**
 * Inflow API client with rate limiting
 *
 * Requires environment variables:
 *   INFLOW_API_KEY - Bearer token
 *   INFLOW_COMPANY_ID - Company GUID
 */

const BASE_URL = 'https://cloudapi.inflowinventory.com';
const API_VERSION = '2025-06-24';
const RATE_LIMIT_DELAY = 1200; // 1.2s = 50 req/min (safe margin under 60/min)

function getEnv() {
  const apiKey = process.env.INFLOW_API_KEY;
  const companyId = process.env.INFLOW_COMPANY_ID;

  if (!apiKey || !companyId) {
    throw new Error('Missing INFLOW_API_KEY or INFLOW_COMPANY_ID environment variables');
  }

  return { apiKey, companyId };
}

let lastRequestTime = 0;

async function rateLimitedFetch(url: URL, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * GET request to Inflow API
 */
export async function get<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T> {
  const { apiKey, companyId } = getEnv();
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

/**
 * PUT request to Inflow API
 */
export async function put<T = unknown>(endpoint: string, body: unknown): Promise<T> {
  const { apiKey, companyId } = getEnv();
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

  // Some PUT responses are empty (204 No Content)
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

interface PaginatedResponse<T> {
  value?: T[];
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

/**
 * GET all items from a paginated endpoint
 */
export async function getAll<T = unknown>(endpoint: string, params: QueryParams = {}): Promise<T[]> {
  const items: T[] = [];
  const seenIds = new Set<string>();
  let skip = 0;
  const top = 100;

  while (true) {
    const response = await get<T[] | PaginatedResponse<T> | T>(endpoint, {
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
      return [response as T];
    }

    if (data.length === 0) break;

    let newCount = 0;
    for (const item of data) {
      const id = extractId(item);
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        items.push(item);
        newCount++;
      }
    }

    if (newCount === 0) break;
    skip += data.length;
  }

  return items;
}

/**
 * GET a single item by ID
 */
export async function getOne<T = unknown>(endpoint: string, id: string, params: QueryParams = {}): Promise<T> {
  return get<T>(`${endpoint}/${id}`, params);
}
