# Cloudsmith API Reference for Package Search

## Base URL

```
https://api.cloudsmith.io/v1/
```

Authentication via `X-Api-Key` header (API Key or Service Account Token).

## Core Endpoints

### List Packages in a Repository

```
GET /v1/packages/{owner}/{repo}/
```

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `query` | string | Cloudsmith search syntax query (see below) |
| `page` | integer | Page number (1-indexed) |
| `page_size` | integer | Results per page (default varies, max 100 for API, extension caps at 30) |
| `sort` | string | CSV sort fields. Prefix with `-` for descending. Options: `name`, `version`, `date`, `downloads`, `status`, `size` |

**Response:** Array of package objects. Key fields for search/permissibility:

```json
{
  "name": "flask",
  "version": "3.0.0",
  "slug": "flask-300-abcdef",
  "slug_perm": "abcdef123456",
  "format": "python",
  "namespace": "my-workspace",
  "repository": "my-repo",
  "status_str": "Completed",
  "status": 4,
  "downloads": 142,
  "uploaded_at": "2025-06-01T12:00:00Z",
  "tags": {
    "info": ["production"],
    "version": ["latest"]
  },
  "is_sync_completed": true,
  "is_sync_failed": false,
  "is_sync_in_progress": false,
  "is_sync_awaiting": false,
  "policy_violated": false,
  "deny_policy_violated": false,
  "license_policy_violated": false,
  "vulnerability_policy_violated": false
}
```

**Pagination Headers:**

```
X-Pagination-Count: 142        # Total results
X-Pagination-Page: 1           # Current page
X-Pagination-PageTotal: 15     # Total pages
X-Pagination-PageSize: 10      # Page size
Link: <...?page=2>; rel="next", <...?page=15>; rel="last"
```

### List Packages Across a Workspace (All Repos)

```
GET /v1/packages/{owner}/
```

Same query parameters as above. Returns packages from ALL repositories the authenticated user can access within the workspace. This is the key endpoint for cross-repo search.

### List Package Groups

```
GET /v1/packages/{owner}/{repo}/groups/
```

**Query Parameters:** `query`, `page`, `page_size`, `sort`

**Response:** Wrapped in `{ "results": [...] }` (note: different from packages list which returns a raw array).

### Get Single Package

```
GET /v1/packages/{owner}/{repo}/{identifier}/
```

Returns full package detail. The `identifier` is the `slug_perm` value.

### List Vulnerabilities for a Package

```
GET /v1/vulnerabilities/{owner}/{repo}/{package}/
```

Returns scan results for a specific package. Useful for showing why a package is quarantined.

### List Upstream Configs

Per-format endpoints:

```
GET /v1/repos/{owner}/{identifier}/upstream/{format}/
```

Where `{format}` is: `deb`, `docker`, `maven`, `npm`, `python`, `ruby`, `dart`, `helm`, `nuget`, `cargo`, `rpm`, `cran`, `swift`, `go`, `hex`, `composer`, `conda`, `conan`, `p2`, `terraform`, `raw`

**Response:** Array of upstream config objects. Key fields:

```json
{
  "name": "PyPI",
  "slug_perm": "abc123",
  "upstream_url": "https://pypi.org/simple/",
  "mode": "Cache and Proxy",
  "is_active": true,
  "pending_validation": false,
  "distro_versions": []
}
```

## Cloudsmith Search Syntax

The `query` parameter supports a rich boolean search language. This is what powers the search box in the Cloudsmith web UI.

### Searchable Fields

| Field | Type | Example |
|-------|------|---------|
| `name` | string | `name:flask` |
| `filename` | string | `filename:flask-3.0.0.tar.gz` |
| `version` | string | `version:3.0.0` |
| `format` | string | `format:python` |
| `status` | string | `status:quarantined`, `status:completed` |
| `tag` | string | `tag:production` |
| `architecture` | string | `architecture:x86_64` |
| `distribution` | string | `distribution:ubuntu/focal` |
| `license` | string | `license:MIT` |
| `downloads` | number | `downloads:>100` |
| `size` | number | `size:<1000000` |
| `uploaded` | date | `uploaded:>'1 month ago'` |
| `prerelease` | boolean | `prerelease:false` |
| `policy_violated` | boolean | `policy_violated:true` |
| `deny_policy_violated` | boolean | `deny_policy_violated:true` |
| `license_policy_violated` | boolean | `license_policy_violated:true` |
| `vulnerability_policy_violated` | boolean | `vulnerability_policy_violated:true` |

### Operators

**Boolean:** `AND` (default when omitted), `OR`, `NOT`

**String matching:**
- `^foo` — starts with
- `foo$` — ends with
- `foo*bar` — fuzzy/wildcard
- `~foo` — negation (NOT)

**Number/date comparisons:**
- `>`, `>=`, `<`, `<=`
- `~=` — compatible version (semver-ish)

### Example Queries

```
# Find all quarantined packages
status:quarantined

# Find non-quarantined Python packages named "flask"
name:flask AND format:python AND NOT status:quarantined

# Find packages with policy violations
policy_violated:true

# Find packages with deny-level violations (strongest signal for "not permissible")
deny_policy_violated:true

# Find packages uploaded in the last week
uploaded:>'1 week ago'

# Find packages by name prefix across all formats
name:^react

# Combine: available packages with no policy issues
NOT status:quarantined AND policy_violated:false
```

### Building Queries for Permissibility

**"Is this package permissible?"** translates to:

```
name:{name} AND NOT status:quarantined AND deny_policy_violated:false
```

**"Show me everything that's blocked":**

```
status:quarantined OR deny_policy_violated:true
```

**"Show me packages that need attention":**

```
policy_violated:true AND NOT deny_policy_violated:true
```

(Packages that triggered a non-deny policy — tagged but not quarantined.)

## API Behavior Notes

1. **Implicit AND.** Omitting boolean operators between terms defaults to AND.
2. **Workspace-level search** (`/packages/{owner}/`) searches ALL repos. This is much more useful for enterprise search than per-repo queries.
3. **page_size can go higher than 30.** The extension currently caps at 30, but the API supports larger pages. For search results, consider `page_size=50` or `page_size=100`.
4. **The packages list endpoint returns a raw JSON array**, not wrapped in an object. Package groups returns `{ "results": [...] }`. This inconsistency matters for parsing.
5. **status_str values:** `"Completed"`, `"Awaiting Sync"`, `"Sync In Progress"`, `"Sync Failed"`, `"Quarantined"`, `"Awaiting Security Scan"`.
6. **Upstream-sourced packages** are tagged with the upstream source name automatically. You can search for these with `tag:{upstream-name}`.
