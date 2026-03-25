<div align="right">

[简体中文](./README.zh-CN.md)

</div>

# Functional Testing

The functional test suite for AI Gateway validates end-to-end behavior for all management and proxy API endpoints.

## Directory Structure

```
tests/functional/
├── helpers/
│   ├── test-data.factory.ts    # Test data factory
│   ├── database.helper.ts      # Database operation helper
│   ├── auth.helper.ts          # Authentication helper
│   ├── api-client.ts           # API client wrapper (dual-worker support)
│   └── index.ts                # Unified exports
├── organization/
│   ├── companies.test.ts       # Company management API
│   ├── users.test.ts           # User management API
│   └── departments.test.ts     # Department management API
├── keys/
│   └── api-keys.test.ts        # API Key management API
├── providers/
│   └── providers.test.ts       # Provider management API
├── models/
│   └── models.test.ts          # Model management API
├── stats/
│   └── stats.test.ts           # Statistics API
├── quotas/
│   └── quotas.test.ts          # Quota management API
├── auth/
│   └── auth-flows.test.ts      # Authentication flow tests
├── proxy/
│   └── proxy-api.test.ts       # Proxy API tests
└── fixtures/
    └── .gitkeep                # Test fixture data
```

## Running Tests

### Prerequisites

1. **Start local development servers**:
   ```bash
   # Start Proxy and Admin Workers together
   npm run dev
   ```

   Service endpoints:
   - **Proxy API:** `http://localhost:8787`
   - **Admin API:** `http://localhost:8788`

2. **Set test environment variables** (optional):
   ```bash
   export TEST_ADMIN_BASE_URL="http://localhost:8788"
   export TEST_PROXY_BASE_URL="http://localhost:8787"
   export TEST_ADMIN_API_KEY="sk-your-admin-key"
   ```

### Run All Functional Tests

```bash
npm run test:functional
```

### Run Specific Module Tests

```bash
# Test only organization management API
npm run test:functional -- tests/functional/organization

# Test only API Keys
npm run test:functional -- tests/functional/keys

# Test only authentication flows
npm run test:functional -- tests/functional/auth
```

### Run Tests with Coverage

```bash
npm run test:functional:coverage
```

## Test Coverage

### Organization Management API

- `GET /admin/companies` - List all companies
- `POST /admin/companies` - Create company
- `GET /admin/companies/:id` - Get company details
- `PUT /admin/companies/:id` - Update company
- `DELETE /admin/companies/:id` - Delete company
- `GET /admin/users` - List users
- `POST /admin/users` - Create user
- `GET /admin/users/:id` - Get user details
- `PUT /admin/users/:id` - Update user
- `DELETE /admin/users/:id` - Delete user
- `GET /admin/departments` - List departments
- `POST /admin/departments` - Create department
- `GET /admin/departments/:id` - Get department details
- `PUT /admin/departments/:id` - Update department
- `DELETE /admin/departments/:id` - Delete department

### API Key Management

- `GET /admin/keys` - List API Keys
- `POST /admin/keys` - Create API Key
- `GET /admin/keys/:id` - Get API Key details
- `PUT /admin/keys/:id` - Update API Key
- `DELETE /admin/keys/:id` - Delete API Key
- `POST /admin/keys/:id/disable` - Disable API Key
- `POST /admin/keys/:id/enable` - Enable API Key
- `POST /admin/keys/:id/bonus` - Add bonus quota

### Provider Management

- `GET /admin/providers` - List providers
- `POST /admin/providers` - Create provider
- `GET /admin/providers/:id` - Get provider details
- `PUT /admin/providers/:id` - Update provider
- `DELETE /admin/providers/:id` - Delete provider
- `POST /admin/providers/:id/credentials` - Add credential
- `DELETE /admin/providers/credentials/:id` - Delete credential

### Model Management

- `GET /admin/models` - List models
- `POST /admin/models` - Create model
- `GET /admin/models/:id` - Get model details
- `PUT /admin/models/:id` - Update model
- `DELETE /admin/models/:id` - Delete model
- `POST /admin/models/:id/providers` - Associate provider
- `DELETE /admin/models/:id/providers/:provider_id` - Remove association
- `POST /admin/departments/:id/models` - Set department model permissions

### Statistics

- `GET /admin/stats/usage` - Usage statistics
- `GET /admin/stats/tokens` - Token usage summary
- `GET /admin/stats/costs` - Cost analysis
- `GET /admin/stats/models` - Model usage statistics
- `GET /admin/logs` - Query usage logs

### Quota Management

- `GET /admin/quotas` - List quotas
- `PUT /admin/quotas/:entityType/:entityId` - Update quota
- `POST /admin/quotas/:entityType/:entityId/reset` - Reset quota
- `POST /admin/quotas/:entityType/:entityId/bonus` - Add bonus quota

### Authentication Flows

- Unlimited quota API Key verification
- Daily quota checking
- Quota pool exhaustion handling
- API Key expiration handling
- API Key disabled handling
- KV cache strategy
- Active invalidation mechanism

### Proxy API

- `GET /v1/models` - List available models
- `POST /v1/messages` - Create message request
- Streaming response handling
- Error response logging

## Data Cleanup Strategy

Each test automatically cleans up test data using the `afterEach` hook:

1. Clear all tables in foreign key constraint order
2. Ensure complete isolation between tests
3. Avoid data residue affecting test results

## Important Notes

1. **Dual Worker Architecture**: Tests require both Proxy and Admin Workers running
2. **Environment Variables**: Tests configure server addresses via `TEST_ADMIN_BASE_URL` and `TEST_PROXY_BASE_URL`
3. **Concurrent Testing**: Each test runs independently using `singleThread: true` configuration
4. **API Key Security**: Test API Keys use known hashes, not real keys
