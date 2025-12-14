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
async function rateLimitedFetch(url, options) {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
    }
    lastRequestTime = Date.now();
    return fetch(url, options);
}
/**
 * GET request to Inflow API
 */
export async function get(endpoint, params = {}) {
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
    return response.json();
}
/**
 * PUT request to Inflow API
 */
export async function put(endpoint, body) {
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
/**
 * GET all items from a paginated endpoint
 */
export async function getAll(endpoint, params = {}) {
    const items = [];
    const seenIds = new Set();
    let skip = 0;
    const top = 100;
    while (true) {
        const response = await get(endpoint, {
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
            return [response];
        }
        if (data.length === 0)
            break;
        let newCount = 0;
        for (const item of data) {
            const id = extractId(item);
            if (id && !seenIds.has(id)) {
                seenIds.add(id);
                items.push(item);
                newCount++;
            }
        }
        if (newCount === 0)
            break;
        skip += data.length;
    }
    return items;
}
/**
 * GET a single item by ID
 */
export async function getOne(endpoint, id, params = {}) {
    return get(`${endpoint}/${id}`, params);
}
