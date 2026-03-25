# Cloudsmith API Reference V3 - Differentiator Features

Supplement to API_REFERENCE.md and API_REFERENCE_V2.md. Covers endpoints for Phases 9-13: upstream dry-run, promotion visibility, quarantine policy trace, entitlement scoping, and repo metrics.

## Policy Simulation (Upstream Dry-Run)

### Simulate Policies Against Packages

```
GET /v2/workspaces/{workspace}/policies/simulate/
```

Runs all workspace policies against packages as if they were active, without actually taking action. Returns which policies would match, reasons, and what actions would be taken.

**Query Parameters:** `page`, `page_size`

**Response:** List of simulation results per package showing match status and actions.

This endpoint is the foundation for "what would happen if I pull this from upstream?" — simulate the policy evaluation before the package is cached.

### List Workspace Policies

```
GET /v2/workspaces/{workspace}/policies/
```

Returns all EPM policies. Key fields: `name`, `slug_perm`, `enabled`, `rego` (the policy code), `description`, `precedence`.

### List Policy Actions

```
GET /v2/workspaces/{workspace}/policies/{policy_slug}/actions/
```

Returns actions attached to a policy. Key fields: `action_type` ("SetPackageState", "AddPackageTags"), `package_state` ("QUARANTINED"), `tags`, `precedence`.

## Policy Decision Logs (Quarantine Trace)

### List Decision Logs

```
GET /v2/workspaces/{workspace}/policies/decision/logs/
```

**Query Parameters:** `page`, `page_size`

Returns decision log entries created when policies evaluate packages. Each entry shows which policy matched, what data was evaluated, and what actions were taken.

**Response fields per entry:**

```json
{
  "slug_perm": "abc123",
  "created_at": "2026-02-12T18:05:12Z",
  "policy": {
    "slug_perm": "8HVpEjheXnrh",
    "name": "High EPSS Score"
  },
  "package": {
    "identifier": "G2UnNXlbvK3BAdBE",
    "name": "spotipy",
    "version": "2.25.0",
    "repository": "production-cli"
  },
  "matched": true,
  "reason": "CVSS 9.8, EPSS > 0.5, patch available",
  "actions_taken": [
    { "action_type": "SetPackageState", "package_state": "QUARANTINED" },
    { "action_type": "AddPackageTags", "tags": ["epss-threshold-breach"] }
  ]
}
```

Note: Decision logs are NOT created for policy simulations — only for actual policy evaluations on real packages.

## Package Copy/Move (Promotion)

### Copy a Package

```
POST /v1/packages/{owner}/{repo}/{identifier}/copy/
```

**Body:** `{ "destination": "{owner}/{target_repo}" }`

The package response object includes fields indicating promotion eligibility:
- `is_copyable` — boolean
- `is_moveable` — boolean

### Move a Package

```
POST /v1/packages/{owner}/{repo}/{identifier}/move/
```

**Body:** `{ "destination": "{owner}/{target_repo}" }`

### Tag a Package

```
POST /v1/packages/{owner}/{repo}/{identifier}/tag/
```

**Body:**
```json
{
  "action": "add",
  "tags": ["promoted-to-production", "approved-2026-03-24"],
  "is_immutable": false
}
```

Tags can be used to track promotion history. The `tags` field on package responses shows all current tags.

## Entitlements

### List Entitlements for a Repository

```
GET /v1/entitlements/{owner}/{repo}/
```

**Query Parameters:** `page`, `page_size`, `show_tokens` (boolean, default false), `query`, `active` (boolean), `sort`

**Response:** Array of entitlement token objects:

```json
{
  "name": "ci-readonly",
  "slug_perm": "GYwg00eEElKs",
  "token": "abc123...",
  "is_active": true,
  "limit_bandwidth": 1073741824,
  "limit_bandwidth_unit": "bytes",
  "limit_num_clients": 10,
  "limit_num_downloads": 1000,
  "limit_package_query": "tag:production",
  "limit_date_range_from": "2026-01-01T00:00:00Z",
  "limit_date_range_to": "2027-01-01T00:00:00Z",
  "created_at": "2025-06-01T00:00:00Z",
  "updated_at": "2026-01-15T00:00:00Z",
  "metadata": { "customer": "Acme Corp", "license": "enterprise" }
}
```

### Entitlement Token Metrics (per repo)

```
GET /v1/metrics/entitlements/{owner}/{repo}/
```

**Query Parameters:** `page`, `page_size`, `start` (datetime), `finish` (datetime), `tokens` (CSV of slug_perms)

Returns bandwidth usage per token.

### Entitlement Token Metrics (account-wide)

```
GET /v1/metrics/entitlements/{owner}/
```

Same parameters as above but across all repos.

## Quota and Metrics

### Quota Usage for a Namespace

```
GET /v1/quota/{owner}/
```

Returns current storage and bandwidth usage for the workspace.

**Response fields:**

```json
{
  "usage": {
    "raw": {
      "bandwidth": { "used": 5368709120, "plan_limit": 107374182400 },
      "storage": { "used": 2147483648, "plan_limit": 53687091200 }
    },
    "display": {
      "bandwidth": { "used": "5.00 GB", "plan_limit": "100.00 GB", "percentage_used": "5.0%" },
      "storage": { "used": "2.00 GB", "plan_limit": "50.00 GB", "percentage_used": "4.0%" }
    }
  }
}
```

### Quota History

```
GET /v1/quota/history/{owner}/
```

Returns historical quota usage. Useful for trending.

### Package Usage Metrics (per repo)

```
GET /v1/metrics/packages/{owner}/{repo}/
```

**Query Parameters:** `page`, `page_size`, `start`, `finish`, `packages` (CSV of slug_perms)

Returns download metrics per package within a repo.
