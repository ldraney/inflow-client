# inflow-client

Minimal HTTP client for the Inflow Inventory API. Shared by `inflow-get` and `inflow-put`.

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
import { get, getAll, put } from 'inflow-client';

// GET single item
const product = await get<Product>('/products/abc-123');

// GET all with pagination
const products = await getAll<Product>('/products');

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

## Structure

```
inflow-client/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts      # All client code (~100 lines)
└── dist/             # Compiled output
```

## Definition of Done

- [ ] `get()`, `getAll()`, `getOne()` work (extracted from inflow-get)
- [ ] `put()` works for create and update
- [ ] Rate limiting works for mixed GET/PUT
- [ ] Published to npm or GitHub packages
- [ ] `inflow-get` updated to depend on this
- [ ] `inflow-put` depends on this
