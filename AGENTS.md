# AGENTS.md - Cloudsmith VS Code Extension

## Project Overview

This is an existing VS Code extension (`cloudsmith-vsc`) that provides a sidebar tree view into Cloudsmith workspaces, repositories, and packages. The extension is JavaScript-only (no TypeScript), uses the Cloudsmith REST API v1, and has zero runtime dependencies. It authenticates via API Key or Service Account Token stored in VS Code's SecretStorage.

**Current state (post Phases 1-13):** The extension has a full package search system with cross-workspace search, permissibility indicators (quarantine status, policy violation flags), upstream awareness (proxy/cache detection, package origin tagging), guided multi-step search with filter presets, recent search history, and per-repo filtering. The tree view shows visual status on all packages via color-coded icons. Vulnerability details with remediation workflows, dependency health scanning, install commands, license classification, upstream dry-run preview, cross-repo promotion, quarantine policy trace, entitlement scoping, and repo metrics are implemented.

**Next goal (V4 Refinements):** Address internal testing feedback: code quality fixes, install command improvements (Docker tag-first, RPM, Raw), vulnerable packages filter, vulnerability severity/CVSS filtering, upstream inspect WebView with Upstream Trust, and workspace-level info restructuring.


## Git Workflow

**DO NOT commit or push code.** All changes must be left as unstaged modifications for manual review before committing.

- **DO NOT** run `git commit`, `git push`, or `git add` followed by `git commit` under any circumstances.
- **DO NOT** create branches, tags, or modify git history.
- **DO** make file changes directly (create, edit, delete files).
- **DO** run `npm run lint` and `npm test` to validate changes.
- **DO** report what files were changed and what was done so the developer can review diffs and commit manually.

If asked to "submit", "save", or "finalize" changes, interpret this as "make the file changes and run validation" — never as "commit to git."

## Protected Files

The following files must NOT be modified unless the task explicitly names them as in-scope. These handle authentication, credential storage, and connection management. Unintended changes to these files can break auth flows or introduce security vulnerabilities.

- `util/cloudsmithAPI.js` — HTTP client, API key handling, redirect validation
- `util/credentialManager.js` — SecretStorage read/write for API keys
- `util/connectionManager.js` — Auth verification and connection state
- `util/ssoAuthManager.js` — SSO and CLI credential import

If you encounter issues in these files while working on an unrelated task, **report the issue but do not modify the file.** Changes to protected files require explicit authorization in the task prompt.

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
│   ├── vulnerabilityNode.js             # Individual CVE tree item
│   ├── vulnerabilitySummaryNode.js      # Collapsible vuln summary under packages
│   ├── licenseNode.js                   # License detail tree item
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
│   ├── searchQueryBuilder.js            # Cloudsmith query syntax builder (use for ALL query construction)
│   ├── paginatedFetch.js               # Paginated API responses
│   ├── installCommandBuilder.js         # Format-native install commands
│   ├── licenseClassifier.js             # License risk classification
│   ├── manifestParser.js               # Dependency manifest parsing
│   ├── transitiveResolver.js            # CLI-based transitive dep resolution
│   ├── versionResolver.js              # Find safe (non-quarantined) versions
│   ├── remediationHelper.js             # Find safe alternative versions
│   ├── upstreamChecker.js              # Upstream resolution + policy simulation
│   ├── diagnosticsPublisher.js          # Inline editor vulnerability diagnostics
│   ├── recentSearches.js               # Search history persistence
│   ├── recentPackages.js               # Recent package snapshot persistence
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

## Reference Documents

- **CLAUDE.md** — Primary project spec. Read this first. Contains architecture decisions, constraints, personas, and validation rules.
- **ARCHITECTURE.md** — File-by-file breakdown of the original codebase and data flow.
- **API_REFERENCE.md** — Core API endpoints: search, packages, upstreams, search syntax.
- **API_REFERENCE_V2.md** — Vulnerability, license, dependency, and install command endpoints.
- **API_REFERENCE_V3.md** — Policy simulation, decision logs, copy/move/tag, entitlements, quota/metrics.
- **IMPLEMENTATION.md** — Phases 1-4: search, permissibility, upstream awareness, filtering.
- **IMPLEMENTATION_V2.md** — Phases 5-8: vulnerability remediation, dep health, install commands, license.
- **IMPLEMENTATION_V3.md** — Phases 9-13: upstream dry-run, promotion, quarantine trace, entitlements, metrics.
- **IMPLEMENTATION_V4.md** — V4 refinements: code quality fixes, install cmd improvements, vuln filter, upstream inspect, workspace restructure.

## Code Conventions

- CommonJS `require()` / `module.exports` everywhere. No ES modules, no TypeScript.
- All tree nodes follow the pattern: constructor(data, context) → getTreeItem() → getChildren()
- `contextValue` on tree items drives which context menu commands appear (defined in package.json menus).
- `CloudsmithAPI.get()` returns parsed JSON on success or an error message STRING on failure. All callers must check `typeof result === 'string'` before using results.
- `CloudsmithAPI.getV2()` is identical but uses `https://api.cloudsmith.io/v2/` base URL.
- Zero runtime dependencies. Only native `fetch`, VS Code APIs, and Node.js standard library.
- Shared mutable state uses module singletons (e.g., `filterState.js`) not context property injection.
- All user input interpolated into Cloudsmith query syntax must be escaped via `SearchQueryBuilder` (in `util/searchQueryBuilder.js`). Never build query strings with raw string interpolation.
- All API payloads must use the exact casing documented in the API reference (e.g., `"add"` not `"Add"` for tag actions, `"{owner}/{repo}"` format for copy/move destinations).
- API redirect handling uses `redirect: 'manual'` with explicit host and protocol validation before following. Never allow credentials to be sent to untrusted hosts or over plaintext HTTP.

## Code Quality and Cleanup

These rules apply to ALL code changes, not just new features:

- **No partial implementations or stubs.** Every function written must be complete and functional. Do not leave `// TODO` placeholders, empty function bodies, or placeholder return values. If a feature cannot be fully implemented in the current scope, do not create the skeleton — note it in your report instead.
- **No function duplication.** Do not create `foo()`, `foo1()`, `foo2()` or `fooNew()` variants. When adding new behavior, update the existing function. If the signature needs to change, update all call sites in the same change. If a function needs to handle a new case, add the case to the existing function rather than creating a parallel copy.
- **Remove dead code.** If a change makes a function, import, variable, or code path unreachable or unused, delete it in the same change. Do not leave orphaned code for "future use." This includes: unused `require()` imports, functions that are no longer called, variables that are assigned but never read, and `else` branches that can no longer be reached.
- **Clean up adjacent code.** When modifying a function or file, fix any immediately visible issues in the surrounding code: inconsistent naming, redundant checks, copy-paste artifacts, misleading comments, or patterns that contradict the conventions in this document. Do not leave known problems next to new code.
- **One way to do things.** If the codebase has two patterns for the same operation (e.g., two different ways to build a query, two different ways to check API errors), consolidate to one pattern as part of the change. Do not introduce a third pattern.
- **Code comments.** If the code requires a comment for explainability, comment MUST be clear and concise and NOT attributed to an AI Agent.

## Data Flow Rules

When passing data between API responses, node constructors, command handlers, and utility functions:

- **Preserve all fields needed downstream.** If a command handler needs `checksum_sha256`, `cdn_url`, or `filename`, the node constructor must capture those fields from the API response. If data is serialized for persistence (e.g., `recentPackages.js`), include all fields that downstream consumers expect.
- **Property names must match exactly at every handoff.** If a constructor reads `this.slugPerm = data.slug_perm`, the caller must pass `slug_perm`, not `slug_perm_raw` or `identifier`. Trace the full path: API response → node constructor → command handler → utility function.
- **Collection keys must be unique across realistic inputs.** Maps, Sets, or dedup keys must include enough context to prevent collisions. Examples: `${format}:${name}` not just `name` for cross-format lookups; `${workspace}:${name}:${version}:${repository}` not just `${name}:${version}:${repository}` for cross-workspace dedup.
- **State must be scoped and cleared correctly.** If a provider caches state (e.g., `currentRepo` on the search provider), it must be reset when scope changes. A repo-scoped search followed by a workspace-wide search must not retain the prior repo context.

## Pre-Submission Validation

After making changes and before reporting completion, run this checklist:

### 1. Automated Checks
- Run `npm run lint` — must pass with no new errors.
- Run `npm test` — must pass with no regressions.

### 2. Property Name Alignment
For every modified function, constructor, or module boundary, verify that property names the caller sends match exactly what the receiver reads. Trace the full data flow from API response through every intermediate layer to the final consumer.

### 3. Collection Key Uniqueness
For every Map, Set, or dedup key, verify the key is unique across all realistic inputs. If data can come from multiple formats, workspaces, namespaces, or repos, the key must include enough context to prevent collisions.

### 4. Defensive Field Access
When checking boolean fields from API responses, account for `undefined`. Use `field !== false` rather than `field === true` if the field may be absent and the safe default is truthy. Be consistent with how the same field is checked elsewhere in the codebase.

### 5. Protocol and Host Validation
Any code that follows redirects, constructs URLs, or sends credentials must validate both the protocol (`https:`) and the hostname before transmitting sensitive data.

### 6. Graceful Handling of Missing Data
When matching or filtering records, consider what happens when optional fields (version, license, checksum, etc.) are null, undefined, or empty strings. Fall back to a reasonable behavior (name-only match, omit the field, show "Unknown") rather than failing silently or producing incorrect results.

### 7. State Scope Verification
When a provider or utility caches state that is scoped (repo, workspace, format), verify that state is cleared or reset when the scope changes. A repo-scoped operation followed by a workspace-scoped operation must not retain stale scope context.

### 8. End-to-End Data Pipeline
For any feature that reads API data and passes it through multiple layers (API → node → command handler → utility), verify the full pipeline by tracing a concrete example. Confirm that every field needed at the end of the pipeline is captured at each intermediate step, including serialization/deserialization boundaries.

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

## MCP Servers

This project has MCP (Model Context Protocol) servers configured. Check `.mcp.json` or project config for available servers. Use them for:

- **Cloudsmith MCP**: Validate API response schemas, verify field names, test queries against live data. Default workspace/namespace: `dl-technology-consulting`.
- **GitHub MCP**: Check PRs, issues, file history, branch state.
- Use MCP tools to verify assumptions about API responses rather than guessing at field names or response shapes.