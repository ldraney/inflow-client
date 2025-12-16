# inflow-client

Minimal HTTP client for the [Inflow Inventory API](https://www.inflowinventory.com/). Shared client layer for [inflow-get](https://github.com/ldraney/inflow-get) and [inflow-put](https://github.com/ldraney/inflow-put) — handles auth and rate limiting so downstream packages don't have to.

## Why use this?

- **Fail-fast config** - Clear errors if credentials are missing
- **Dual rate limiting** - Handles both per-minute (60/min) and window (1000/window) limits
- **Full pagination** - `getAll()` fetches every page with progress logging
- **TypeScript native** - Full type support out of the box
- **Tiny footprint** - No dependencies

## Rate Limiting

Inflow API has two rate limits:

| Limit | Header | How we handle it |
|-------|--------|------------------|
| Per minute | `x-inflow-api-rate-limit: N/60` | 1.2s delay between requests |
| Per window | `x-ratelimit-limit: N/1000` | Pause 5 min when <50 remaining |

The client automatically pauses before hitting limits, so you'll never see 429 errors during normal operation.

## Installation

```bash
npm install inflow-client
```

## Usage

```typescript
import { createClient } from 'inflow-client';

const client = createClient({
  apiKey: process.env.INFLOW_API_KEY!,
  companyId: process.env.INFLOW_COMPANY_ID!,
});

// GET a single resource
const product = await client.get<Product>('/products/abc-123');

// GET all items (handles pagination automatically)
const allProducts = await client.getAll<Product>('/products');

// GET one by ID
const product = await client.getOne<Product>('/products', 'abc-123');

// PUT (create or update)
await client.put('/products/abc-123', { name: 'Widget', itemType: 'Inventory' });
```

## API

```typescript
// Factory (recommended)
createClient(config: InflowClientConfig): InflowClient

interface InflowClientConfig {
  apiKey: string;
  companyId: string;
}

interface InflowClient {
  get<T>(endpoint: string, params?: QueryParams): Promise<T>;
  getAll<T>(endpoint: string, params?: QueryParams): Promise<T[]>;
  getOne<T>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
  put<T>(endpoint: string, body: unknown): Promise<T>;
}
```

## Legacy API (deprecated)

Bare functions that read from environment variables still work for backwards compatibility:

```typescript
import { get, getAll, getOne, put } from 'inflow-client';

// Requires INFLOW_API_KEY and INFLOW_COMPANY_ID env vars
const products = await getAll<Product>('/products');
```

## License

MIT
