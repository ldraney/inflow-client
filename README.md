# inflow-client

Minimal HTTP client for the [Inflow Inventory API](https://www.inflowinventory.com/).

## Why use this?

- **Fail-fast config** - Clear errors if credentials are missing
- **Rate limiting built-in** - Automatically handles Inflow's 50 req/min limit
- **Full pagination** - `getAll()` fetches every page automatically
- **TypeScript native** - Full type support out of the box
- **Tiny footprint** - No dependencies

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
