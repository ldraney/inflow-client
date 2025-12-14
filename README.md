# inflow-client

Minimal HTTP client for the [Inflow Inventory API](https://www.inflowinventory.com/).

## Why use this?

- **Zero config** - Just set two environment variables and go
- **Rate limiting built-in** - Automatically handles Inflow's 50 req/min limit
- **Full pagination** - `getAll()` fetches every page automatically
- **TypeScript native** - Full type support out of the box
- **Tiny footprint** - ~100 lines, no dependencies

## Installation

```bash
npm install inflow-client
```

## Setup

Set your Inflow credentials as environment variables:

```bash
export INFLOW_API_KEY="your-api-key"
export INFLOW_COMPANY_ID="your-company-guid"
```

## Usage

```typescript
import { get, getAll, getOne, put } from 'inflow-client';

// GET a single resource
const product = await get<Product>('/products/abc-123');

// GET all items (handles pagination automatically)
const allProducts = await getAll<Product>('/products');

// GET one by ID
const product = await getOne<Product>('/products', 'abc-123');

// PUT (create or update)
await put('/products/abc-123', { name: 'Widget', itemType: 'Inventory' });
```

## API

```typescript
get<T>(endpoint: string, params?: QueryParams): Promise<T>
getAll<T>(endpoint: string, params?: QueryParams): Promise<T[]>
getOne<T>(endpoint: string, id: string, params?: QueryParams): Promise<T>
put<T>(endpoint: string, body: unknown): Promise<T>
```

## License

MIT
