# Cloudsmith VS Code Extension - Enterprise Package Intelligence

## Project Overview

This is an existing VS Code extension (`cloudsmith-vsc`) that provides a sidebar tree view into Cloudsmith workspaces, repositories, and packages. The extension is JavaScript-only (no TypeScript), uses the Cloudsmith REST API v1, and has zero runtime dependencies. It authenticates via API Key or Service Account Token stored in VS Code's SecretStorage.

**Current state (post Phases 1-4):** The extension has a full package search system with cross-workspace search, permissibility indicators (quarantine status, policy violation flags), upstream awareness (proxy/cache detection, package origin tagging), guided multi-step search with filter presets, recent search history, and per-repo filtering. The tree view shows visual status on all packages via color-coded icons.

**Next goal (Phases 5-8):** Add security remediation workflows (vulnerability details, find safe version), developer productivity features (dependency health scanning from project manifests, copy install commands), and license compliance visibility (risk classification, restrictive license flagging).

## Repository

- **Source:** https://github.com/cloudsmith-io/cloudsmith-vscode-extension
- **Language:** JavaScript (CommonJS modules, no bundler)
- **VS Code engine:** ^1.99.0
- **Entry point:** `extension.js`
- **No runtime dependencies** (uses native `fetch`)

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full file-by-file breakdown of the original codebase.

## Cloudsmith API Surface

See [API_REFERENCE.md](./API_REFERENCE.md) for the core API endpoints, search syntax, and response schemas (search, packages, upstreams).

See [API_REFERENCE_V2.md](./API_REFERENCE_V2.md) for vulnerability, license, dependency, and install command API endpoints (Phases 5-8).

See [API_REFERENCE_V3.md](./API_REFERENCE_V3.md) for policy simulation, decision logs, copy/move/tag, entitlements, and quota/metrics endpoints (Phases 9-13).

## Implementation Plans

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for Phases 1-4: search infrastructure, permissibility indicators, upstream awareness, and advanced filtering.

See [IMPLEMENTATION_V2.md](./IMPLEMENTATION_V2.md) for Phases 5-8: vulnerability details + remediation, dependency health view, install commands, and license visibility.

See [IMPLEMENTATION_V3.md](./IMPLEMENTATION_V3.md) for Phases 9-13: upstream dry-run preview, cross-repo promotion with tag policies, quarantine policy trace, entitlement scoping, and repo metrics. These are Cloudsmith differentiators with no JFrog equivalent.

## Target Personas

### Enterprise Security / Compliance
Phases 5 + 8. Needs to see vulnerability details inline (CVE, CVSS, EPSS, fix availability) and take remediation action without leaving VS Code. Needs license risk classification with configurable restrictive license lists that align with corporate legal policy. The "find safe version" workflow is the key differentiator.

### Developer (Daily Use)
Phases 6 + 7. Needs the extension to be aware of what they're actually building. The Dependency Health view reads project manifests and cross-references every declared dependency against Cloudsmith, surfacing blocked/clean/missing status at a glance. Copy install commands eliminate the context-switch to the web UI for setup boilerplate.

## Key Decisions and Constraints

### What "Permissible" Means

A package is considered permissible when ALL of the following are true:

1. **Not quarantined** - `status_str` is NOT `"Quarantined"`. Quarantined packages have failed a policy gate (vulnerability, license, or custom Rego policy) and should be visually flagged as blocked.
2. **Available locally OR resolvable via upstream** - The package either exists in the repository directly, or can be served through a configured upstream proxy. The extension should distinguish between these two states so developers understand the supply chain path.
3. **Policy-clean** - No active `deny` policy violations. The API exposes `policy_violated`, `deny_policy_violated`, `license_policy_violated`, and `vulnerability_policy_violated` as searchable fields.

### What "Upstream" Means in Context

Cloudsmith repositories can have upstream proxy/cache configurations. When a package is requested that doesn't exist locally, Cloudsmith fetches it from the upstream, caches it, and (if Block Until Scan is enabled) holds it until policy evaluation completes. The extension should surface:

- Whether a repo HAS upstream configs (via `GET /v1/repos/{owner}/{repo}/upstream/{format}/`)
- Whether a specific package was cached from upstream (packages cached from upstreams get tagged with the upstream source name)
- Whether a package is still pending sync/scan (`status_str` values: `"Completed"`, `"Awaiting Sync"`, `"Quarantined"`, etc.)

### Technical Constraints

- **No new runtime dependencies.** The extension currently has zero. Use native `fetch`, VS Code APIs, and standard Node.js modules only.
- **Keep the existing tree view working.** All new features are additive. Don't break the current Workspace > Repo > Package hierarchy.
- **Respect the 30-package API page size limit** the extension currently uses, but the search feature should support pagination beyond this.
- **API rate awareness.** Cloudsmith API has rate limits. Debounce search input (300ms minimum). Cache results where practical using `globalState`.
- **Authentication model unchanged.** Reuse existing `CredentialManager` and `CloudsmithAPI` classes. No new auth flows.

### Code Style

- CommonJS `require()` / `module.exports` throughout. No ES modules.
- Classes for nodes and providers. No functional component patterns.
- VS Code API patterns: `TreeDataProvider`, `EventEmitter` for refresh, `SecretStorage` for credentials.
- Existing code has some rough edges (double-wrapping in `getChildren`, inconsistent `typeof` checks). New code should be clean but consistent with the existing style where it won't cause confusion.
- No TypeScript. This is a deliberate choice by the maintainers.

### Testing

- Current test coverage is minimal (single `extension.test.js` placeholder).
- New features should include unit tests for the search query builder, result filtering, and node construction.
- Use the existing `@vscode/test-cli` and `@vscode/test-electron` setup.

## File Structure (Current)

```
cloudsmith-vscode-extension/
├── extension.js                    # Entry point, command registration
├── package.json                    # Extension manifest, contributions
├── models/
│   ├── helpNode.js                 # Help & Feedback tree items
│   ├── packageDetailsNode.js       # Leaf nodes showing package metadata
│   ├── packageGroupsNode.js        # Package group tree items
│   ├── packageNode.js              # Individual package tree items
│   ├── repositoryNode.js           # Repository tree items
│   └── workspaceNode.js            # Workspace tree items
├── views/
│   ├── cloudsmithProvider.js       # Main tree data provider
│   └── helpProvider.js             # Help & Feedback tree provider
├── util/
│   ├── cloudsmithAPI.js            # HTTP client wrapping Cloudsmith v1 API
│   ├── connectionManager.js        # Auth verification and connection state
│   └── credentialManager.js        # SecretStorage read/write for API keys
├── test/
│   └── extension.test.js           # Placeholder test file
└── media/                          # Icons, logos, screenshots
```

## Quick Reference: Running the Extension

```bash
# Install dev dependencies
npm install

# Open in VS Code and press F5 to launch Extension Development Host
code .

# Lint
npm run lint

# Test
npm test
```
