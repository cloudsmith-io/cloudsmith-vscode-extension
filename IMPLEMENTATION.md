# Implementation Plan - Package Search for Cloudsmith VS Code Extension

## Phase Overview

| Phase | Scope | Complexity | Dependencies |
|-------|-------|------------|-------------|
| 1 | Search infrastructure + basic search | Medium | None |
| 2 | Permissibility indicators | Medium | Phase 1 |
| 3 | Upstream awareness | Low-Medium | Phase 1 |
| 4 | Advanced filtering + QuickPick | Medium | Phase 1 |

Each phase is independently shippable.

---

## Phase 1: Search Infrastructure + Basic Search

### Goal

Add a search box to the Cloudsmith sidebar that queries packages across a workspace (or within a selected repo) and displays results in the tree view. Support pagination beyond the current 30-item cap.

### New Files

#### `util/searchQueryBuilder.js`

Constructs Cloudsmith search syntax strings from structured input.

```javascript
// Builds query strings for the Cloudsmith packages API
// Handles escaping, boolean operators, and field-specific syntax

class SearchQueryBuilder {
  constructor() {
    this.terms = [];
  }

  // Add a name search term (fuzzy by default)
  name(value) { /* ... */ }

  // Add a format filter
  format(value) { /* ... */ }

  // Add a status filter
  status(value) { /* ... */ }

  // Add a raw query term (pass-through for advanced users)
  raw(queryString) { /* ... */ }

  // Build the final query string
  build() {
    return this.terms.join(' AND ');
  }

  // Static helper: build a permissibility query
  static permissible(name) {
    return `name:${name} AND NOT status:quarantined AND deny_policy_violated:false`;
  }
}

module.exports = { SearchQueryBuilder };
```

#### `util/paginatedFetch.js`

Wraps `CloudsmithAPI.get()` with pagination support by parsing response headers.

```javascript
// Handles paginated API responses from Cloudsmith
// Returns both data and pagination metadata

class PaginatedFetch {
  constructor(cloudsmithAPI) {
    this.api = cloudsmithAPI;
  }

  // Fetch a single page with pagination metadata
  // Returns { data: [], pagination: { page, pageTotal, count, pageSize } }
  async fetchPage(endpoint, page, pageSize) { /* ... */ }

  // Fetch all pages (use with caution - respect rate limits)
  async fetchAll(endpoint, pageSize, maxPages) { /* ... */ }
}

module.exports = { PaginatedFetch };
```

**Important:** This requires modifying `CloudsmithAPI.makeRequest()` to return response headers alongside the JSON body. Current implementation discards headers entirely. The modification should be backward-compatible:

```javascript
// In cloudsmithAPI.js, modify makeRequest to optionally return headers
async makeRequest(endpoint, requestOptions, includeHeaders = false) {
  const url = apiURL + endpoint;
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status} - ${response.statusText}`);
    }
    const result = await response.json();
    if (includeHeaders) {
      return {
        data: result,
        headers: {
          page: response.headers.get('X-Pagination-Page'),
          pageTotal: response.headers.get('X-Pagination-PageTotal'),
          count: response.headers.get('X-Pagination-Count'),
          pageSize: response.headers.get('X-Pagination-PageSize'),
        }
      };
    }
    return result;
  } catch (error) {
    return error.message;
  }
}
```

Also add a `getWithHeaders(endpoint, apiKey)` method that calls `makeRequest` with `includeHeaders = true`.

#### `views/searchProvider.js`

New `TreeDataProvider` for search results. Registered as a separate view in the sidebar, below the main workspace view.

```javascript
class SearchProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.searchResults = [];
    this.pagination = null;
  }

  // Execute a search against a workspace
  async search(workspace, query, page) { /* ... */ }

  // Clear results
  clear() { /* ... */ }

  // TreeDataProvider interface
  getTreeItem(element) { return element.getTreeItem(); }
  getChildren(element) { /* ... */ }

  refresh() { this._onDidChangeTreeData.fire(); }
}
```

#### `models/searchResultNode.js`

Tree node for search results. Similar to `PackageNode` but adds:
- Visual indicator for status (checkmark, warning, error icons)
- Repository name in the label (since results span repos)
- Quarantine state as a prominent detail

```javascript
class SearchResultNode {
  constructor(pkg, context) {
    // Similar to PackageNode but label includes repo context
    // e.g., "flask 3.0.0  (my-repo)"
    // Icon varies based on status_str and policy_violated
  }

  getTreeItem() {
    // Use ThemeIcon based on permissibility:
    // - $(check) for clean, completed packages
    // - $(warning) for policy_violated but not denied
    // - $(error) for quarantined or deny_policy_violated
    // - $(sync) for awaiting sync/scan
  }

  getChildren() {
    // Return PackageDetailsNode instances plus additional:
    // - Policy status
    // - Repository name
    // - Upstream source tag (if present)
  }
}
```

### Modifications to Existing Files

#### `package.json`

Add to `contributes.views.cloudsmithSideBar`:

```json
{
  "id": "cloudsmithSearchView",
  "name": "Package Search"
}
```

Add new commands:

```json
{
  "command": "cloudsmith-vsc.searchPackages",
  "title": "Search Packages",
  "category": "Cloudsmith",
  "icon": "$(search)"
},
{
  "command": "cloudsmith-vsc.clearSearch",
  "title": "Clear Search Results",
  "category": "Cloudsmith",
  "icon": "$(clear-all)"
},
{
  "command": "cloudsmith-vsc.searchNextPage",
  "title": "Load More Results",
  "category": "Cloudsmith"
},
{
  "command": "cloudsmith-vsc.searchInWorkspace",
  "title": "Search packages in this workspace"
}
```

Add to `contributes.menus.view/title`:

```json
{
  "command": "cloudsmith-vsc.searchPackages",
  "group": "navigation",
  "when": "view == cloudsmithSearchView"
},
{
  "command": "cloudsmith-vsc.clearSearch",
  "group": "navigation",
  "when": "view == cloudsmithSearchView"
}
```

Add context menu for workspace nodes:

```json
{
  "command": "cloudsmith-vsc.searchInWorkspace",
  "when": "view == cloudsmithView && viewItem == workspace",
  "group": "navigation"
}
```

Add new settings:

```json
{
  "cloudsmith-vsc.searchPageSize": {
    "type": "integer",
    "default": 50,
    "minimum": 10,
    "maximum": 100,
    "description": "Number of results per page when searching packages."
  },
  "cloudsmith-vsc.searchDebounceMs": {
    "type": "integer",
    "default": 300,
    "minimum": 100,
    "maximum": 1000,
    "description": "Debounce delay (ms) before executing a search query."
  }
}
```

#### `extension.js`

Register the new search provider and commands:

```javascript
// In activate():
const { SearchProvider } = require("./views/searchProvider");
const searchProvider = new SearchProvider(context);
vscode.window.createTreeView("cloudsmithSearchView", {
  treeDataProvider: searchProvider,
  showCollapseAll: true,
});

// Register search command
context.subscriptions.push(
  vscode.commands.registerCommand("cloudsmith-vsc.searchPackages", async () => {
    // 1. Get available workspaces from cache or fetch
    // 2. Show QuickPick to select workspace (or use last-used)
    // 3. Show InputBox for search query
    // 4. Execute search via searchProvider.search()
  }),

  vscode.commands.registerCommand("cloudsmith-vsc.clearSearch", () => {
    searchProvider.clear();
  }),

  vscode.commands.registerCommand("cloudsmith-vsc.searchNextPage", async () => {
    // Load next page of current search
  }),

  vscode.commands.registerCommand("cloudsmith-vsc.searchInWorkspace", async (item) => {
    // Pre-populate workspace from context menu, show search input
  }),
);
```

### Search UX Flow

1. User clicks search icon in the "Package Search" view title bar
2. QuickPick appears with available workspaces (pulled from cached workspace data or fresh API call)
3. User selects workspace
4. InputBox appears: "Search packages (e.g., name:flask, format:python)"
5. Results populate the search tree view with `SearchResultNode` items
6. If more pages exist, a "Load More Results (X of Y)" item appears at the bottom
7. User can right-click results for the same actions as regular packages (inspect, open in browser, copy)

---

## Phase 2: Permissibility Indicators

### Goal

Surface clear visual indicators on ALL packages (not just search results) showing whether they are permissible, quarantined, or have policy violations.

### Modifications

#### `models/packageNode.js`

Add permissibility-aware icon logic to `getTreeItem()`:

```javascript
getTreeItem() {
  let iconPath = "";
  let format = this.format;
  let status = this.status_str;
  let policyViolated = this.policy_violated;
  let denyViolated = this.deny_policy_violated;

  // Determine permissibility icon overlay/badge
  // Priority: quarantined > deny violated > policy violated > format icon
  if (status === "Quarantined" || denyViolated) {
    iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
  } else if (policyViolated) {
    iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
  } else if (status === "Completed") {
    // Use format-specific icon (existing behavior)
    // ... existing icon logic ...
  } else {
    // Syncing, awaiting, etc.
    iconPath = new vscode.ThemeIcon('sync');
  }

  return {
    label: pkg,
    description: status === "Quarantined" ? "⛔ Quarantined" : undefined,
    tooltip: this._buildTooltip(),
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    contextValue: status === "Quarantined" ? "packageQuarantined" : "package",
    iconPath: iconPath,
  };
}
```

**Note:** This requires the `PackageNode` constructor to capture additional fields from the API response that it currently ignores:

```javascript
constructor(pkg, context) {
  // ... existing fields ...
  this.status_str_raw = pkg.status_str;  // raw status string
  this.policy_violated = pkg.policy_violated || false;
  this.deny_policy_violated = pkg.deny_policy_violated || false;
  this.license_policy_violated = pkg.license_policy_violated || false;
  this.vulnerability_policy_violated = pkg.vulnerability_policy_violated || false;
}
```

#### `models/packageDetailsNode.js`

Add detail nodes for policy status:

```javascript
// New detail types to handle:
if (id.toLowerCase().includes("policy")) {
  if (value === "true" || value === true) {
    iconPath = new vscode.ThemeIcon('shield', new vscode.ThemeColor('errorForeground'));
  } else {
    iconPath = new vscode.ThemeIcon('shield', new vscode.ThemeColor('testing.iconPassed'));
  }
}
```

#### `models/repositoryNode.js`

Pass the full API response fields through to `PackageNode` so policy fields are available. The current constructor only passes a subset. Ensure the raw `pkg` object flows through intact.

---

## Phase 3: Upstream Awareness

### Goal

Show developers whether a repository has upstream sources configured, and whether individual packages originated from an upstream (cached) vs. being directly published.

### New Files

#### `models/upstreamIndicatorNode.js`

A special tree node that appears at the top of a repository's package list when upstreams are configured.

```javascript
class UpstreamIndicatorNode {
  constructor(upstreams) {
    this.upstreams = upstreams; // Array of upstream configs
  }

  getTreeItem() {
    const count = this.upstreams.length;
    const active = this.upstreams.filter(u => u.is_active).length;
    return {
      label: `Upstreams: ${active} active of ${count} configured`,
      tooltip: this.upstreams.map(u => `${u.name} (${u.upstream_url})`).join('\n'),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "upstreamIndicator",
      iconPath: new vscode.ThemeIcon('cloud'),
    };
  }

  getChildren() { return []; }
}
```

### Modifications

#### `models/repositoryNode.js`

In `getPackages()`, also fetch upstream configs for the repo's primary format(s) to determine if upstreams exist. Cache the result.

```javascript
async getUpstreams() {
  // Determine formats used in this repo (may need a separate call or inference)
  // For each format, GET /v1/repos/{owner}/{repo}/upstream/{format}/
  // Cache results in context.globalState
  // Return array of upstream configs
}
```

#### `models/searchResultNode.js`

Check package tags for upstream source names. If present, show an indicator:

```javascript
// In getTreeItem():
const isFromUpstream = this.tags && this.tags.info &&
  this.tags.info.some(tag => tag.includes('upstream'));
if (isFromUpstream) {
  // Add "(via upstream)" to description
}
```

#### Package Detail Enhancement

Add an "Origin" detail to packages that shows:
- "Direct" — package was uploaded directly to the repo
- "Upstream: {name}" — package was cached from an upstream source
- "Upstream (pending)" — package is being fetched/scanned from upstream

---

## Phase 4: Advanced Filtering + QuickPick Search

### Goal

Provide a structured search experience via VS Code QuickPick with multi-step filtering, plus a persistent filter bar for the main tree view.

### New Command: Guided Search

```
cloudsmith-vsc.guidedSearch
```

Multi-step QuickPick flow:

1. **Select workspace** (QuickPick from cached workspaces)
2. **Select scope** — "All repositories" or pick specific repo(s) (multi-select QuickPick)
3. **Select filter** — Pre-built options:
   - "All packages"
   - "Available packages only" (not quarantined, no deny violations)
   - "Quarantined packages"
   - "Packages with policy violations"
   - "Custom query..." (free text input)
4. **Optional: format filter** — "All formats" or pick specific (npm, python, maven, etc.)
5. Execute search, populate results view

### New Command: Filter Current View

```
cloudsmith-vsc.filterPackages
```

Adds a filter to the existing tree view without switching to the search view. Uses VS Code's built-in tree view filtering if available, or applies a query filter to the current repo's package list.

### New Settings

```json
{
  "cloudsmith-vsc.defaultSearchScope": {
    "type": "string",
    "enum": ["workspace", "repository"],
    "default": "workspace",
    "description": "Default scope for package search."
  },
  "cloudsmith-vsc.showPermissibilityIndicators": {
    "type": "boolean",
    "default": true,
    "description": "Show visual indicators for package permissibility status."
  },
  "cloudsmith-vsc.recentSearches": {
    "type": "integer",
    "default": 10,
    "minimum": 0,
    "maximum": 50,
    "description": "Number of recent searches to remember."
  }
}
```

---

## File Summary: What Gets Created and Modified

### New Files (Phase 1-4)

| File | Phase | Purpose |
|------|-------|---------|
| `util/searchQueryBuilder.js` | 1 | Build Cloudsmith query strings |
| `util/paginatedFetch.js` | 1 | Paginated API fetching |
| `views/searchProvider.js` | 1 | Search results tree provider |
| `models/searchResultNode.js` | 1 | Search result tree item |
| `models/upstreamIndicatorNode.js` | 3 | Upstream config indicator |
| `models/loadMoreNode.js` | 1 | "Load more results" tree item |
| `test/searchQueryBuilder.test.js` | 1 | Unit tests for query builder |
| `test/searchProvider.test.js` | 1 | Tests for search provider |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `package.json` | 1 | New view, commands, settings, menus |
| `extension.js` | 1 | Register search provider and commands |
| `util/cloudsmithAPI.js` | 1 | Add `getWithHeaders()`, modify `makeRequest()` for pagination |
| `models/packageNode.js` | 2 | Add permissibility icons, capture policy fields |
| `models/packageDetailsNode.js` | 2 | Add policy status detail rendering |
| `models/repositoryNode.js` | 2-3 | Pass full API data, fetch upstream configs |

---

## Implementation Notes

### Debouncing Search Input

If implementing real-time search-as-you-type (as opposed to submit-on-enter), use a debounce utility:

```javascript
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

The `searchDebounceMs` setting controls the delay. Default 300ms balances responsiveness with API kindness.

### Caching Search Results

Use `context.globalState` with namespaced keys:

```javascript
const cacheKey = `cloudsmith-search:${workspace}:${queryHash}`;
context.globalState.update(cacheKey, {
  timestamp: Date.now(),
  results: results,
  pagination: pagination
});
```

Expire cache after 5 minutes. Don't cache across sessions.

### Error States to Handle

1. **Not connected** — Show "Connect to Cloudsmith to search" message item in tree
2. **No results** — Show "No packages found matching '{query}'" message item
3. **API error** — Show error message item with retry action
4. **Rate limited** — Show "Rate limited. Try again in {seconds}s" with auto-retry
5. **Pagination exhausted** — Hide "Load More" node

### Contextual Actions on Search Results

Search results should support the same right-click actions as regular packages:
- Inspect package (reuse existing `cloudsmith-vsc.inspectPackage`)
- Open in Cloudsmith (reuse existing `cloudsmith-vsc.openPackage`)
- Copy details (reuse existing `cloudsmith-vsc.copySelected`)

This works because the context menu is driven by `contextValue`. Set `contextValue: "package"` on search result nodes to inherit the existing menu items, or create a new `"searchResult"` context value with its own menu entries plus the shared ones.
