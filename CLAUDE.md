# inflow-client

Shared HTTP client for the Inflow Inventory API. Handles auth and rate limiting so downstream packages (`inflow-get`, `inflow-put`) don't have to.

## Purpose

A thin, focused client that:

- Reads credentials from environment variables
- Handles rate limiting (50 req/min)
- Provides typed `get()` and `put()` methods
- Manages auth headers and API versioning

**Not responsible for:** schemas, validation, database, business logic.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFLOW_API_KEY` | Yes | Inflow API bearer token |
| `INFLOW_COMPANY_ID` | Yes | Inflow company GUID |

These must be set before importing the client.

## Usage

```typescript
import { createClient } from 'inflow-client';

const client = createClient({
  apiKey: process.env.INFLOW_API_KEY!,
  companyId: process.env.INFLOW_COMPANY_ID!,
});

// GET single item
const product = await client.get<Product>('/products/abc-123');

// GET all with pagination
const products = await client.getAll<Product>('/products');

// GET one by ID
const product = await client.getOne<Product>('/products', 'abc-123');

// PUT (create or update)
await client.put('/products/abc-123', { name: 'Widget', itemType: 'Inventory' });
```

## API

```typescript
createClient(config: InflowClientConfig): InflowClient

interface InflowClientConfig {
  apiKey: string;
  companyId: string;
  rateLimitConfig?: RateLimitConfig;
}

interface RateLimitConfig {
  windowThreshold?: number;      // Default: 20
  windowDurationMs?: number;     // Default: 3600000 (1 hour)
  bufferRequests?: number;       // Default: 50
  onRateLimitPause?: (info: RateLimitPauseInfo) => void;
}

interface InflowClient {
  get<T>(endpoint: string, params?: QueryParams): Promise<T>;
  getAll<T>(endpoint: string, params?: QueryParams): Promise<T[]>;
  getOne<T>(endpoint: string, id: string, params?: QueryParams): Promise<T>;
  put<T>(endpoint: string, body: unknown): Promise<T>;
}
```

## Structure

```
inflow-client/
├── CLAUDE.md
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts      # All client code (~100 lines)
└── dist/             # Compiled output
```

## Status

**Complete.** Published to npm as `inflow-client@0.2.1`.

See [inflow-get](https://github.com/ldraney/inflow-get) and [inflow-put](https://github.com/ldraney/inflow-put) for downstream consumers.
