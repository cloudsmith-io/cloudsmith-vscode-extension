# Cloudsmith VS Code Extension - Enterprise Package Intelligence

## Project Overview

This is an existing VS Code extension (`cloudsmith-vsc`) that provides a sidebar tree view into Cloudsmith workspaces, repositories, and packages. The extension is JavaScript-only (no TypeScript), uses the Cloudsmith REST API v1, and has zero runtime dependencies. It authenticates via API Key or Service Account Token stored in VS Code's SecretStorage.

**Current state (post Phases 1-13):** The extension has a full package search system with cross-workspace search, permissibility indicators (quarantine status, policy violation flags), upstream awareness (proxy/cache detection, package origin tagging), guided multi-step search with filter presets, recent search history, and per-repo filtering. The tree view shows visual status on all packages via color-coded icons. Vulnerability details with remediation workflows, dependency health scanning, install commands, license classification, upstream dry-run preview, cross-repo promotion, quarantine policy trace, entitlement scoping, and repo metrics are implemented.

**Next goal (V4 Refinements):** Address internal testing feedback: code quality fixes, install command improvements (Docker tag-first, RPM, Raw), vulnerable packages filter, vulnerability severity/CVSS filtering, upstream inspect WebView with Upstream Trust, and workspace-level info restructuring.

## Git Workflow

**DO NOT commit code.** All changes must be left as unstaged modifications for manual review before committing. Specifically:

- **DO NOT** run `git commit` under any circumstances.
- **DO NOT** run `git push` under any circumstances.
- **DO NOT** run `git add` followed by `git commit`.
- **DO NOT** create commits even with descriptive messages.
- **DO** make file changes directly (create, edit, delete files).
- **DO** run `npm run lint` and `npm test` to validate changes.
- **DO** report what files were changed and what was done so the developer can review diffs and commit manually.

If asked to "submit", "save", or "finalize" changes, interpret this as "make the file changes and run validation" — never as "commit to git."

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

See [IMPLEMENTATION_V4.md](./IMPLEMENTATION_V4.md) for V4 refinements: housekeeping + code quality fixes, install command improvements, vulnerable packages filter, vulnerability severity/CVSS filter, upstream inspect WebView with Upstream Trust, and workspace-level info restructuring with storage region per repo.

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

### What "Upstream Trust" Means

Upstream Trust is a supply chain security feature that prevents dependency confusion / namesquatting attacks. Currently supported for NPM, Python, and Maven, but any format where the API response contains `trust_level` means it's active. Values are "Trusted" or "Untrusted".

- The local Cloudsmith repository is always implicitly trusted.
- When a package is requested, Cloudsmith checks if that name exists in any trusted source (local repo or trusted upstreams).
- If the name IS found in a trusted source, untrusted upstreams are blocked from serving versions of that package.
- If the name is NOT found in any trusted source, all upstreams (including untrusted) can serve it.
- **Untrusted is the recommended default** for all upstreams because it enables dependency confusion protections.
- **Trusted** means the upstream bypasses these protections and can serve any package including those with names that collide with private packages.

### Technical Constraints

- **No new runtime dependencies.** The extension currently has zero. Use native `fetch`, VS Code APIs, and standard Node.js modules only.
- **Keep the existing tree view working.** All new features are additive. Don't break the current Workspace > Repo > Package hierarchy.
- **Respect the 30-package API page size limit** the extension currently uses, but the search feature should support pagination beyond this.
- **API rate awareness.** Cloudsmith API has rate limits. Debounce search input (300ms minimum). Cache results where practical using `globalState`.
- **Authentication model unchanged.** Reuse existing `CredentialManager` and `CloudsmithAPI` classes. No new auth flows.
- **Graceful permission handling.** Not all users have owner-level permissions. API calls to endpoints like `/v1/quota/{owner}/` or `/v1/orgs/{owner}/` may return 403. Handle these gracefully (show "Not available" or omit the feature) rather than throwing errors.

### Code Style

- CommonJS `require()` / `module.exports` throughout. No ES modules.
- Classes for nodes and providers. No functional component patterns.
- VS Code API patterns: `TreeDataProvider`, `EventEmitter` for refresh, `SecretStorage` for credentials.
- Existing code has some rough edges (double-wrapping in `getChildren`, inconsistent `typeof` checks). New code should be clean but consistent with the existing style where it won't cause confusion.
- No TypeScript. This is a deliberate choice by the maintainers.
- All user input interpolated into Cloudsmith query syntax must be escaped via `SearchQueryBuilder` (in `util/searchQueryBuilder.js`). Never build query strings with raw string interpolation.
- All API payloads must use the exact casing documented in the API reference (e.g., `"add"` not `"Add"` for tag actions, `"{owner}/{repo}"` format for copy/move destinations).

### Code Quality and Cleanup

These rules apply to ALL code changes, not just new features:

- **No partial implementations or stubs.** Every function written must be complete and functional. Do not leave `// TODO` placeholders, empty function bodies, or placeholder return values. If a feature cannot be fully implemented in the current scope, do not create the skeleton — note it in your report instead.
- **No function duplication.** Do not create `foo()`, `foo1()`, `foo2()` or `fooNew()` variants. When adding new behavior, update the existing function. If the signature needs to change, update all call sites in the same change. If a function needs to handle a new case, add the case to the existing function rather than creating a parallel copy.
- **Remove dead code.** If a change makes a function, import, variable, or code path unreachable or unused, delete it in the same change. Do not leave orphaned code for "future use." This includes: unused `require()` imports, functions that are no longer called, variables that are assigned but never read, and `else` branches that can no longer be reached.
- **Clean up adjacent code.** When modifying a function or file, fix any immediately visible issues in the surrounding code: inconsistent naming, redundant checks, copy-paste artifacts, misleading comments, or patterns that contradict the conventions in this document. Do not leave known problems next to new code.
- **One way to do things.** If the codebase has two patterns for the same operation (e.g., two different ways to build a query, two different ways to check API errors), consolidate to one pattern as part of the change. Do not introduce a third pattern.
- **Code comments.** If the code requires a comment for explainability, comment MUST be clear and concise and NOT attributed to an AI Agent.

### Testing

- Current test coverage is minimal (single `extension.test.js` placeholder).
- New features should include unit tests for the search query builder, result filtering, and node construction.
- Use the existing `@vscode/test-cli` and `@vscode/test-electron` setup.
- Always run `npm run lint` and `npm test` after making changes.

### Pre-Submission Validation

After making changes and before reporting completion, trace through every modified code path and verify:

1. **Property name alignment.** When passing data between functions, constructors, or modules, verify that the property names the caller sends match exactly what the receiver reads. If a constructor reads `this.slugPerm = data.slug_perm`, the caller must pass an object with `slug_perm`, not `slug_perm_raw` or `identifier`.
2. **Collection key uniqueness.** When using Maps, Sets, or objects as lookup tables, verify that the key is unique across all realistic inputs. If data can come from multiple formats, namespaces, or repos, the key must include enough context to avoid collisions (e.g., `${format}:${name}` not just `name`).
3. **Defensive field access.** When checking boolean fields from API responses, account for `undefined`. Use `field !== false` rather than `field === true` if the field may be absent and the safe default is truthy. Be consistent with how the same field is checked elsewhere in the codebase.
4. **Protocol and host validation.** Any code that follows redirects, constructs URLs, or sends credentials must validate both the protocol (`https:`) and the hostname before transmitting sensitive data.
5. **Graceful handling of missing data.** When matching or filtering records, consider what happens when optional fields (version, license, checksum, etc.) are null, undefined, or empty strings. Fall back to a reasonable behavior (name-only match, omit the field, show "Unknown") rather than failing silently or producing incorrect results.

## File Structure (Current)

```
cloudsmith-vscode-extension/
├── extension.js                    # Entry point, command registration
├── package.json                    # Extension manifest, contributions
├── models/
│   ├── helpNode.js                 # Help & Feedback tree items
│   ├── packageDetailsNode.js       # Leaf nodes showing package metadata
│   ├── packageGroupsNode.js        # Package group tree items
│   ├── packageNode.js              # Individual package tree items with permissibility icons
│   ├── repositoryNode.js           # Repository tree items with filter, upstream, entitlement support
│   ├── workspaceNode.js            # Workspace tree items
│   ├── searchResultNode.js         # Search result items
│   ├── dependencyHealthNode.js     # Dependency health status items
│   ├── promotionStatusNode.js      # Cross-repo promotion status
│   ├── upstreamIndicatorNode.js    # Upstream proxy/cache indicator
│   ├── entitlementNode.js          # Entitlement token display
│   ├── repoMetricsNode.js          # Storage/bandwidth metrics
│   ├── loadMoreNode.js             # Pagination "load more" item
│   ├── vulnerabilityNode.js        # Individual CVE tree item
│   ├── vulnerabilitySummaryNode.js # Collapsible vuln summary under packages
│   ├── licenseNode.js              # License detail tree item
│   └── helpNode.js                 # Help & feedback links
├── views/
│   ├── cloudsmithProvider.js       # Main workspace/repo tree provider
│   ├── searchProvider.js           # Package search results provider
│   ├── dependencyHealthProvider.js # Dependency scanning provider
│   ├── helpProvider.js             # Help & Feedback tree provider
│   ├── vulnerabilityProvider.js    # CVE detail WebView panel
│   ├── upstreamPreviewProvider.js  # Upstream resolution preview WebView
│   └── promotionProvider.js        # Package promotion logic
├── util/
│   ├── cloudsmithAPI.js            # HTTP client (v1 + v2 endpoints)
│   ├── connectionManager.js        # Auth verification
│   ├── credentialManager.js        # SecretStorage for API keys
│   ├── ssoAuthManager.js           # SSO + CLI credential import
│   ├── searchQueryBuilder.js       # Cloudsmith query syntax builder (use for all query construction)
│   ├── paginatedFetch.js           # Paginated API responses
│   ├── installCommandBuilder.js    # Format-native install commands
│   ├── licenseClassifier.js        # License risk classification
│   ├── manifestParser.js           # Dependency manifest parsing
│   ├── transitiveResolver.js       # CLI-based transitive dep resolution
│   ├── versionResolver.js          # Find safe (non-quarantined) versions
│   ├── remediationHelper.js        # Find safe alternative versions
│   ├── upstreamChecker.js          # Upstream resolution + policy simulation
│   ├── diagnosticsPublisher.js     # Inline editor vulnerability diagnostics
│   ├── recentSearches.js           # Search history persistence
│   └── filterState.js              # Shared repo filter state (module singleton)
├── test/
│   ├── extension.test.js
│   ├── searchQueryBuilder.test.js
│   ├── installCommandBuilder.test.js
│   ├── licenseClassifier.test.js
│   ├── manifestParser.test.js
│   ├── recentSearches.test.js
│   ├── versionResolver.test.js
│   └── integration/
│       ├── setup.js
│       ├── search.test.js
│       ├── vulnerabilities.test.js
│       ├── installCommand.test.js
│       ├── licenseClassifier.test.js
│       └── manifestParser.test.js
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