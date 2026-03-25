# AGENTS.md - Cloudsmith VS Code Extension

## Project Overview

This is a VS Code extension (`cloudsmith-vsc`) that provides package intelligence, security remediation, and developer productivity features for the Cloudsmith artifact management platform. It is JavaScript-only (CommonJS modules), has zero runtime dependencies, and uses the Cloudsmith REST API v1 and v2.

## Repository Structure

```
cloudsmith-vscode-extension/
├── extension.js                         # Entry point, all command registrations
├── package.json                         # Extension manifest (commands, menus, settings, views)
├── models/                              # Tree node classes (TreeItem providers)
│   ├── packageNode.js                   # Individual package display with permissibility icons
│   ├── packageDetailsNode.js            # Leaf nodes for package metadata
│   ├── packageGroupsNode.js             # Package group display
│   ├── repositoryNode.js                # Repository with filter, upstream, entitlement support
│   ├── workspaceNode.js                 # Workspace tree items
│   ├── searchResultNode.js              # Search result items
│   ├── dependencyHealthNode.js          # Dependency health status items
│   ├── promotionStatusNode.js           # Cross-repo promotion status
│   ├── upstreamIndicatorNode.js         # Upstream proxy/cache indicator
│   ├── entitlementNode.js               # Entitlement token display
│   ├── repoMetricsNode.js              # Storage/bandwidth metrics
│   ├── loadMoreNode.js                  # Pagination "load more" item
│   └── helpNode.js                      # Help & feedback links
├── views/                               # TreeDataProviders and WebView panels
│   ├── cloudsmithProvider.js            # Main workspace/repo tree provider
│   ├── searchProvider.js                # Package search results provider
│   ├── dependencyHealthProvider.js      # Dependency scanning provider
│   ├── helpProvider.js                  # Help links provider
│   ├── vulnerabilityProvider.js         # CVE detail WebView panel
│   ├── upstreamPreviewProvider.js       # Upstream resolution preview WebView
│   └── promotionProvider.js             # Package promotion logic
├── util/                                # Shared utilities
│   ├── cloudsmithAPI.js                 # HTTP client (v1 + v2 endpoints)
│   ├── connectionManager.js             # Auth verification
│   ├── credentialManager.js             # SecretStorage for API keys
│   ├── ssoAuthManager.js               # SSO + CLI credential import
│   ├── searchQueryBuilder.js            # Cloudsmith query syntax builder
│   ├── paginatedFetch.js               # Paginated API responses
│   ├── installCommandBuilder.js         # Format-native install commands
│   ├── licenseClassifier.js             # License risk classification
│   ├── manifestParser.js               # Dependency manifest parsing
│   ├── transitiveResolver.js            # CLI-based transitive dep resolution
│   ├── versionResolver.js              # Find safe (non-quarantined) versions
│   ├── upstreamChecker.js              # Upstream resolution + policy simulation
│   ├── diagnosticsPublisher.js          # Inline editor vulnerability diagnostics
│   ├── recentSearches.js               # Search history persistence
│   └── filterState.js                   # Shared repo filter state (module singleton)
├── test/                                # Unit and integration tests
│   ├── extension.test.js
│   ├── searchQueryBuilder.test.js
│   ├── installCommandBuilder.test.js
│   ├── licenseClassifier.test.js
│   ├── manifestParser.test.js
│   ├── recentSearches.test.js
│   ├── versionResolver.test.js
│   └── integration/                     # Live API integration tests
│       ├── setup.js
│       ├── search.test.js
│       ├── vulnerabilities.test.js
│       ├── installCommand.test.js
│       ├── licenseClassifier.test.js
│       └── manifestParser.test.js
└── media/                               # Icons, logos, screenshots
```

## Code Conventions

- CommonJS `require()` / `module.exports` everywhere. No ES modules, no TypeScript.
- All tree nodes follow the pattern: constructor(data, context) → getTreeItem() → getChildren()
- `contextValue` on tree items drives which context menu commands appear (defined in package.json menus)
- `CloudsmithAPI.get()` returns parsed JSON on success or an error message STRING on failure. All callers must check `typeof result === 'string'` before using results.
- `CloudsmithAPI.getV2()` is identical but uses `https://api.cloudsmith.io/v2/` base URL.
- Zero runtime dependencies. Only native `fetch`, VS Code APIs, and Node.js standard library.
- Shared mutable state uses module singletons (e.g., `filterState.js`) not context property injection.

## How to Run Tests

```bash
npm install
npm run lint
npm test

# Integration tests (require live API key)
CLOUDSMITH_TEST_API_KEY=xxx npm test
```

## Known Architectural Quirk

The original codebase had a double-wrapping bug where `getChildren()` in `repositoryNode.js` and `workspaceNode.js` re-wrapped already-constructed node instances. This has been fixed but `packageDetailsNode.js` still handles both single-wrapped `{id, value}` and double-wrapped `{label: {id, value}}` formats defensively.

## Key API Endpoints

- v1: `https://api.cloudsmith.io/v1/` — packages, repos, namespaces, vulnerabilities, entitlements, quota, metrics
- v2: `https://api.cloudsmith.io/v2/` — EPM policies, policy actions, decision logs, policy simulation
