/**
 * Inflow API client with rate limiting
 */
const BASE_URL = 'https://cloudapi.inflowinventory.com';
const API_VERSION = '2025-06-24';
const RATE_LIMIT_DELAY = 1200; // 1.2s = 50 req/min (safe margin under 60/min)
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 60000; // 60s default if no Retry-After header
const DEFAULT_WINDOW_THRESHOLD = 20; // Pause when this many requests remain in window
const DEFAULT_WINDOW_DURATION = 3600000; // 1 hour sliding window
const DEFAULT_BUFFER_REQUESTS = 50; // Wait until this many requests will have aged out
// ============================================================================
// Factory
// ============================================================================
/**
 * Create an Inflow API client with explicit configuration.
 * Fails fast with clear error messages if config is invalid.
 */
export function createClient(config) {
    if (!config.apiKey) {
        throw new Error('apiKey is required - get your API key from Inflow Settings > API');
    }
    if (!config.companyId) {
        throw new Error('companyId is required - get your Company ID from Inflow Settings > API');
    }
    const { apiKey, companyId, rateLimitConfig = {} } = config;
    const windowThreshold = rateLimitConfig.windowThreshold ?? DEFAULT_WINDOW_THRESHOLD;
    const windowDurationMs = rateLimitConfig.windowDurationMs ?? DEFAULT_WINDOW_DURATION;
    const bufferRequests = rateLimitConfig.bufferRequests ?? DEFAULT_BUFFER_REQUESTS;
    const onRateLimitPause = rateLimitConfig.onRateLimitPause;
    let lastRequestTime = 0;
    const requestTimestamps = [];
    function parseRetryAfter(response) {
        const retryAfter = response.headers.get('Retry-After');
        if (!retryAfter)
            return DEFAULT_RETRY_DELAY;
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
    function cleanOldTimestamps() {
        const cutoff = Date.now() - windowDurationMs;
        while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
            requestTimestamps.shift();
        }
    }
    function calculateOptimalWait(targetRecovery) {
        if (requestTimestamps.length === 0)
            return 0;
        // Sort timestamps (should already be sorted, but ensure it)
        requestTimestamps.sort((a, b) => a - b);
        // Find when 'targetRecovery' requests will have aged out
        // The Nth oldest timestamp + windowDuration = when it expires
        const targetIndex = Math.min(targetRecovery - 1, requestTimestamps.length - 1);
        const targetTimestamp = requestTimestamps[targetIndex];
        const expirationTime = targetTimestamp + windowDurationMs;
        const waitTime = Math.max(0, expirationTime - Date.now());
        return waitTime;
    }
    async function rateLimitedFetch(url, options, retryCount = 0) {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        if (elapsed < RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
        }
        lastRequestTime = Date.now();
        // Record this request timestamp and clean up old ones
        requestTimestamps.push(lastRequestTime);
        cleanOldTimestamps();
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
                if (remaining <= windowThreshold) {
                    // Calculate optimal wait time based on when requests will age out
                    const waitMs = calculateOptimalWait(bufferRequests);
                    const waitMinutes = Math.round(waitMs / 60000);
                    const pauseInfo = {
                        remaining,
                        used,
                        max,
                        waitMs,
                        requestsToRecover: bufferRequests,
                    };
                    if (onRateLimitPause) {
                        onRateLimitPause(pauseInfo);
                    }
                    console.warn(`Approaching window rate limit (${used}/${max}, ${remaining} remaining). ` +
                        `Waiting ${waitMinutes} min for ${bufferRequests} requests to age out...`);
                    if (waitMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, waitMs));
                        // Clean up timestamps after waiting
                        cleanOldTimestamps();
                    }
                }
            }
        }
        return response;
    }
    async function clientGet(endpoint, params = {}) {
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
        return response.json();
    }
    async function clientPut(endpoint, body) {
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
        if (!text)
            return undefined;
        return JSON.parse(text);
    }
    function extractId(item) {
        if (!item || typeof item !== 'object')
            return null;
        const obj = item;
        for (const key of Object.keys(obj)) {
            if (key.endsWith('Id') && typeof obj[key] === 'string') {
                return obj[key];
            }
        }
        return null;
    }
    async function clientGetAll(endpoint, params = {}) {
        const items = [];
        const seenIds = new Set();
        let skip = 0;
        const top = 100;
        let page = 1;
        while (true) {
            console.log(`  Fetching ${endpoint} page ${page} (skip=${skip})...`);
            const response = await clientGet(endpoint, {
                ...params,
                top,
                skip,
            });
            let data;
            if (Array.isArray(response)) {
                data = response;
            }
            else if (response && typeof response === 'object' && 'value' in response && Array.isArray(response.value)) {
                data = response.value;
            }
            else {
                console.log(`  Fetched 1 record from ${endpoint}`);
                return [response];
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
    async function clientGetOne(endpoint, id, params = {}) {
        return clientGet(`${endpoint}/${id}`, params);
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
function getEnvConfig() {
    const apiKey = process.env.INFLOW_API_KEY;
    const companyId = process.env.INFLOW_COMPANY_ID;
    if (!apiKey || !companyId) {
        throw new Error('Missing INFLOW_API_KEY or INFLOW_COMPANY_ID environment variables');
    }
    return { apiKey, companyId };
}
let defaultClient = null;
function getDefaultClient() {
    if (!defaultClient) {
        defaultClient = createClient(getEnvConfig());
    }
    return defaultClient;
}
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function get(endpoint, params = {}) {
    return getDefaultClient().get(endpoint, params);
}
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function getAll(endpoint, params = {}) {
    return getDefaultClient().getAll(endpoint, params);
}
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function getOne(endpoint, id, params = {}) {
    return getDefaultClient().getOne(endpoint, id, params);
}
/**
 * @deprecated Use createClient() instead for explicit configuration
 */
export async function put(endpoint, body) {
    return getDefaultClient().put(endpoint, body);
}
