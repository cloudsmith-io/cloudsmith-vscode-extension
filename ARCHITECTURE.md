# Architecture - Cloudsmith VS Code Extension

## How the Extension Works Today

### Activation Flow

1. `package.json` declares `activationEvents: ["onStartupFinished"]` — the extension activates after VS Code finishes startup.
2. `extension.js#activate()` creates the `CloudsmithProvider` tree data provider and registers it against the `cloudsmithView` tree view.
3. Commands are registered inline in `activate()` (the code notes a future move to a `CommandManager`).
4. The `helpProvider` is registered separately for the `helpView`.

### Data Flow: Workspace > Repo > Package

```
CloudsmithProvider.getWorkspaces()
  └─ GET /v1/namespaces/?sort=slug
     └─ Returns array of workspace objects
        └─ Each wrapped in WorkspaceNode

WorkspaceNode.getChildren()
  └─ WorkspaceNode.getRepositories()
     └─ GET /v1/repos/{workspace}/?sort=name
        └─ Each wrapped in RepositoryNode

RepositoryNode.getChildren()
  └─ RepositoryNode.getPackages()
     ├─ [packages mode] GET /v1/packages/{workspace}/{repo}/?sort=-date&page_size={max}
     │  └─ Each wrapped in PackageNode
     └─ [groups mode]   GET /v1/packages/{workspace}/{repo}/groups/?sort=-last_push&page_size={max}
        └─ Each wrapped in PackageGroupsNode

PackageNode.getChildren() / PackageGroupsNode.getChildren()
  └─ Returns array of PackageDetailsNode (leaf items showing metadata)
```

### Key Architectural Patterns

#### CloudsmithAPI (util/cloudsmithAPI.js)

- Thin wrapper around `fetch()`.
- Base URL hardcoded: `https://api.cloudsmith.io/v1/`
- Only two methods: `get(endpoint, apiKey?)` and `post(endpoint, payload, apiKey)`.
- Auth via `X-Api-Key` header, pulled from `CredentialManager` if not passed explicitly.
- **No pagination support.** Returns only the first page of results.
- **No error handling beyond status check.** Errors return the error message string, not a structured error object. Callers don't consistently check for this.
- **No query parameter builder.** Endpoints are constructed via string concatenation.

#### Node Model Pattern

All tree nodes follow the same interface:
- Constructor takes raw API data + context
- `getTreeItem()` returns a VS Code `TreeItem`-compatible object (label, icon, collapsibleState, contextValue)
- `getChildren()` returns child nodes (or empty array for leaf nodes)
- `contextValue` drives which context menu commands appear (set in `package.json` menus)

#### State Management

- **Connection state:** Stored in `context.secrets` as `"cloudsmith-vsc.isConnected"` (string "true"/"false"/"error")
- **Workspace cache:** Stored in `context.globalState` under `"CloudsmithCache"` — currently only caches the last-fetched workspaces/repos, not packages
- **Settings:** VS Code configuration under `cloudsmith-vsc.*` namespace

### Existing Configuration Properties

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `cloudsmith-vsc.useLegacyWebApp` | boolean | false | Use cloudsmith.io instead of app.cloudsmith.com for URLs |
| `cloudsmith-vsc.inspectOutput` | boolean | false | Send inspect output to new doc instead of Output panel |
| `cloudsmith-vsc.showMaxPackages` | integer | 30 | Max packages per repo (1-30) |
| `cloudsmith-vsc.groupByPackageGroups` | boolean | false | Show package groups instead of individual packages |

### Existing Commands

| Command ID | Context | Purpose |
|-----------|---------|---------|
| `cloudsmith-vsc.configureCredentials` | title bar | Prompt for API key |
| `cloudsmith-vsc.clearCredentials` | title bar | Delete stored API key |
| `cloudsmith-vsc.connectCloudsmith` | title bar | Test connection |
| `cloudsmith-vsc.refreshView` | title bar | Refresh tree |
| `cloudsmith-vsc.openSettings` | title bar | Open extension settings |
| `cloudsmith-vsc.inspectPackage` | package context menu | Show raw JSON |
| `cloudsmith-vsc.inspectPackageGroup` | package group context menu | Show raw JSON for group |
| `cloudsmith-vsc.openPackage` | package context menu | Open in browser |
| `cloudsmith-vsc.openPackageGroup` | package group context menu | Open in browser |
| `cloudsmith-vsc.copySelected` | detail context menu | Copy value to clipboard |

### Known Issues in Current Code

1. **WorkspaceNode.getChildren() double-wraps:** `getRepositories()` already creates `RepositoryNode` instances, then `getChildren()` wraps those nodes in NEW `RepositoryNode` instances, passing the node object as the `repo` parameter. This means the second-level nodes receive a `RepositoryNode` object where they expect a raw API response. The code works because it only reads `.slug` and `.name` which exist on both.

2. **RepositoryNode.getChildren() same issue:** `getPackages()` creates node instances, then `getChildren()` re-wraps them.

3. **Error handling is string-based:** `CloudsmithAPI.makeRequest()` catches errors and returns `error.message` as a string. Callers iterate over the response assuming it's an array, which silently fails on error strings.

4. **No pagination headers parsed:** The API returns `Link`, `X-Pagination-Count`, `X-Pagination-Page`, `X-Pagination-PageTotal` headers, but `makeRequest()` only returns `response.json()`, discarding headers entirely.

5. **openPackageGroup has undefined variables:** Lines 210-211 reference `format` and `version` which are never defined in that scope (only used in the legacy URL path).

6. **globalState cache is overwritten:** Both `CloudsmithProvider` and `WorkspaceNode` write to the same `"CloudsmithCache"` key, overwriting each other.

These issues should be noted but not necessarily fixed as part of the search feature work, unless they directly interfere.
