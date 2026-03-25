# Implementation Plan V3 - Cloudsmith Differentiators

Continuation of IMPLEMENTATION.md (Phases 1-4) and IMPLEMENTATION_V2.md (Phases 5-8). These features have no equivalent in the JFrog VS Code extension and leverage Cloudsmith-unique capabilities.

## Phase Overview

| Phase | Feature | Unique To Cloudsmith | Complexity | Dependencies |
|-------|---------|---------------------|------------|-------------|
| 9 | Upstream proxy resolution preview | Yes — upstream dry-run with policy simulation | Medium | Phase 3 (upstream awareness) |
| 10 | Cross-repo promotion visibility + tagging | Yes — copy/move with tag policies | Medium | Phase 2 (permissibility) |
| 11 | Quarantine reason with full policy trace | Yes — EPM decision logs | Low-Medium | Phase 5 (vulnerability panel) |
| 12 | Entitlement token scoping visibility | Yes — per-repo token management | Low | None |
| 13 | Repository storage and bandwidth metrics | Yes — quota/metrics APIs | Low | None |

Phases 12 and 13 are standalone and low effort. Phase 11 enhances the existing vulnerability panel. Phases 9 and 10 are the highest-impact differentiators.

---

## Phase 9: Upstream Proxy Resolution Preview

### Goal

Let a developer search for a package that doesn't exist locally, see that it's resolvable via an upstream, and preview what policies would apply before the first download triggers caching. A "what if I pull this?" dry run that no other IDE extension provides.

### New Files

#### `views/upstreamPreviewProvider.js`

WebView panel that shows the upstream resolution preview.

```javascript
class UpstreamPreviewProvider {
  constructor(context) {
    this.context = context;
    this.panel = null;
  }

  // Show preview for a package that isn't in the repo yet
  async show(workspace, repo, packageName, format) {
    // 1. Check if the package exists locally first
    //    GET /v1/packages/{owner}/{repo}/?query=name:^{packageName}$&format:{format}
    //    If found locally: show "This package already exists in {repo}" and display its current status
    //
    // 2. If NOT found locally, check upstream configs
    //    GET /v1/repos/{owner}/{repo}/upstream/{format}/
    //    If no upstreams: show "No upstream configured for {format} in {repo}"
    //
    // 3. If upstreams exist, list them with status
    //    Show which upstreams are active and would be consulted
    //
    // 4. Simulate policy evaluation
    //    GET /v2/workspaces/{workspace}/policies/simulate/
    //    Show which policies would apply and what actions would be taken
    //
    // 5. Render in WebView with:
    //    - Package name and format
    //    - "Not in {repo} — would resolve via upstream"
    //    - List of active upstreams that could serve it
    //    - Policy simulation results: "Policy 'cvss_gt_7' would evaluate this package"
    //    - If Block Until Scan is enabled on the workspace, note that the package would be held until scan completes
    //    - "Pull this package" button (future: triggers an actual download)
  }
}
```

#### `util/upstreamChecker.js`

Utility that checks upstream resolution and policy simulation.

```javascript
class UpstreamChecker {
  constructor(cloudsmithAPI) {
    this.api = cloudsmithAPI;
  }

  // Check if a package exists locally
  async existsLocally(workspace, repo, name, format) { /* ... */ }

  // Get upstream configs that could resolve this package format
  async getUpstreamsForFormat(workspace, repo, format) { /* ... */ }

  // Run policy simulation to preview what would happen
  async simulatePolicies(workspace) { /* ... */ }

  // Combined check: does it exist, can upstream resolve it, what policies apply
  async previewResolution(workspace, repo, name, format) {
    // Returns: { existsLocally, upstreams[], policySimulation, blockUntilScan }
  }
}
```

### Modifications

#### `package.json`

New command:

```json
{
  "command": "cloudsmith-vsc.previewUpstreamResolution",
  "title": "Preview Upstream Resolution",
  "category": "Cloudsmith",
  "icon": "$(cloud-download)"
}
```

Add to search view title bar and as a standalone command accessible via command palette. Also add a context menu entry on the "not found" dependency health nodes (from Phase 6) since those are prime candidates for upstream resolution.

#### `extension.js`

Register command. Flow: prompt for package name and format (or infer from context), select repo, run the preview, show the WebView.

### UX Flow

1. Developer searches for a package and gets "Not found in Cloudsmith"
2. Right-clicks → "Preview Upstream Resolution"
3. WebView shows: "flask 3.0.0 is not in production-cli, but would resolve via upstream 'PyPI' (https://pypi.org/simple/)"
4. Below: "Policy simulation: 'cvss_gt_7' would evaluate this package on sync. If CVSS > 7 and EPSS > 0.2, package would be quarantined."
5. Developer makes an informed decision before triggering the pull

---

## Phase 10: Cross-Repository Promotion Visibility + Tag Policies

### Goal

Show where a package came from, where it's been promoted to, whether it's eligible for promotion, and allow configurable tag policies for promoted packages. Cloudsmith's copy/move between repos is a core workflow that no IDE extension currently surfaces.

### New Files

#### `views/promotionProvider.js`

Tree view or WebView showing promotion status for a package.

```javascript
class PromotionProvider {
  constructor(context, cloudsmithAPI) {
    this.context = context;
    this.api = cloudsmithAPI;
  }

  // Check promotion status for a package
  async getPromotionStatus(workspace, repo, pkg) {
    // 1. Check is_copyable and is_moveable from the package response
    //    (already available from the packages list API)
    //
    // 2. Look for promotion-related tags on the package:
    //    - "promoted-from-{repo}" tags indicate origin
    //    - "promoted-to-{repo}" tags indicate destinations
    //    - Custom tag patterns from settings
    //
    // 3. Search other repos in the workspace for the same package name+version
    //    GET /v1/packages/{owner}/?query=name:^{name}$ AND version:{version}
    //    This shows everywhere this exact version exists
    //
    // 4. For each repo where the package exists, check its status
    //    (quarantined in dev but clean in staging? Interesting.)
    //
    // Returns: {
    //   currentRepo, status, isCopyable, isMoveable,
    //   existsInRepos: [{ repo, status, tags }],
    //   promotionTags: [],
    //   eligibleTargets: []
    // }
  }

  // Promote (copy) a package to a target repo with optional tagging
  async promote(workspace, sourceRepo, slugPerm, targetRepo, tags) {
    // 1. POST /v1/packages/{owner}/{sourceRepo}/{slugPerm}/copy/
    //    Body: { "destination": "{owner}/{targetRepo}" }
    //
    // 2. If tags are configured, tag the source package:
    //    POST /v1/packages/{owner}/{sourceRepo}/{slugPerm}/tag/
    //    Body: { "action": "add", "tags": ["promoted-to-{targetRepo}", ...] }
    //
    // 3. Optionally tag the destination copy:
    //    First find the new copy's slugPerm in the target repo
    //    POST /v1/packages/{owner}/{targetRepo}/{newSlugPerm}/tag/
    //    Body: { "action": "add", "tags": ["promoted-from-{sourceRepo}", ...] }
  }
}
```

#### `models/promotionStatusNode.js`

Tree node showing promotion info under a package.

```javascript
class PromotionStatusNode {
  constructor(promotionData) {
    // Shows: "Exists in: dev (quarantined), staging (clean), production (not present)"
    // Icon: $(git-compare) for promotion context
  }
}
```

### Settings

```json
"cloudsmith-vsc.promotionRepos": {
  "type": "array",
  "items": { "type": "string" },
  "default": [],
  "description": "Ordered list of repository slugs representing your promotion pipeline (e.g., ['dev', 'staging', 'production']). Used for promotion visibility and one-click promotion."
},
"cloudsmith-vsc.promotionTags": {
  "type": "object",
  "default": {
    "onPromote": ["promoted-to-{target}", "approved-{date}"],
    "onReceive": ["promoted-from-{source}"]
  },
  "description": "Tag templates applied when promoting packages. {target}, {source}, and {date} are replaced automatically."
}
```

### Commands

```json
{
  "command": "cloudsmith-vsc.showPromotionStatus",
  "title": "Show Promotion Status"
},
{
  "command": "cloudsmith-vsc.promotePackage",
  "title": "Promote Package"
}
```

### UX Flow

1. Developer right-clicks a package → "Show Promotion Status"
2. Sees: "flask 3.0.1 — exists in dev (clean), staging (not present), production (not present)"
3. Clicks "Promote to staging" button
4. Package is copied to staging, tagged with "promoted-from-dev" and "approved-2026-03-24"
5. Source package tagged with "promoted-to-staging"

---

## Phase 11: Quarantine Reason with Full Policy Trace

### Goal

When a package is quarantined, show exactly which policy matched, what Rego rule evaluated to true, and what actions were taken. Turns "quarantined" from a dead end into actionable context.

### Modifications (no new files needed — enhance existing vulnerability WebView)

#### `views/vulnerabilityProvider.js`

Add a new section to the WebView panel above the CVE table:

**Policy Decision Trace**

```html
<div class="policy-trace">
  <h3>Why This Package Was Quarantined</h3>
  <div class="policy-card">
    <div class="policy-name">Policy: High EPSS Score (8HVpEjheXnrh)</div>
    <div class="policy-reason">CVSS 9.8, EPSS > 0.5, patch available</div>
    <div class="actions-taken">
      <span class="action quarantine">Quarantined</span>
      <span class="action tag">Tagged: epss-threshold-breach</span>
    </div>
    <div class="policy-owner">Contact: Devon in #devsecops</div>
  </div>
</div>
```

#### Data fetching

In the `show()` method, after fetching vulnerability data, also fetch the decision log:

```javascript
// Fetch decision logs filtered to this package
// GET /v2/workspaces/{workspace}/policies/decision/logs/
// Filter client-side for entries matching this package's identifier
const decisionLogs = await this.api.get(
  `../v2/workspaces/${workspace}/policies/decision/logs/?page_size=50`
);
// Note: The v2 endpoint uses a different base path. May need to adjust CloudsmithAPI
// to support v2 calls, or construct the URL manually.
```

**Important:** The `CloudsmithAPI` class hardcodes `https://api.cloudsmith.io/v1/` as the base URL. The decision logs endpoint is v2. Either:
- Add a `getV2(endpoint)` method to `CloudsmithAPI` that uses `https://api.cloudsmith.io/v2/` as the base
- Or construct the full URL manually for v2 calls

#### Parsing the status_reason field

The package's `status_reason` field already contains rich context like "Quarantined by High EPSS Score. This package was quarantined by a security policy. Update to a newer safe version..." Parse this to extract:
- Policy name (after "Quarantined by")
- Policy slug (in parentheses at the end)
- Action guidance (the middle text)

Display this prominently at the top of the vulnerability panel, before the CVE table.

---

## Phase 12: Entitlement Token Scoping Visibility

### Goal

Show on each repository which entitlement tokens exist, whether they're active, what package scope they have, and their usage limits. Helps developers understand why they can or can't access packages.

### New Files

#### `models/entitlementNode.js`

Tree node for displaying entitlement tokens under a repository.

```javascript
class EntitlementNode {
  constructor(entitlement) {
    this.name = entitlement.name;
    this.isActive = entitlement.is_active;
    this.slugPerm = entitlement.slug_perm;
    this.limitPackageQuery = entitlement.limit_package_query;
    this.limitNumDownloads = entitlement.limit_num_downloads;
    this.limitBandwidth = entitlement.limit_bandwidth;
    this.limitNumClients = entitlement.limit_num_clients;
    this.dateRangeFrom = entitlement.limit_date_range_from;
    this.dateRangeTo = entitlement.limit_date_range_to;
    this.metadata = entitlement.metadata;
  }

  getTreeItem() {
    const active = this.isActive;
    const icon = active
      ? new vscode.ThemeIcon('key', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('key', new vscode.ThemeColor('descriptionForeground'));

    let description = active ? "Active" : "Disabled";
    if (this.limitPackageQuery) {
      description += ` — scope: ${this.limitPackageQuery}`;
    }

    return {
      label: this.name,
      description: description,
      tooltip: this._buildTooltip(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "entitlement",
      iconPath: icon,
    };
  }

  _buildTooltip() {
    const lines = [`Token: ${this.name}`, `Status: ${this.isActive ? 'Active' : 'Disabled'}`];
    if (this.limitPackageQuery) lines.push(`Package scope: ${this.limitPackageQuery}`);
    if (this.limitNumDownloads) lines.push(`Download limit: ${this.limitNumDownloads}`);
    if (this.limitBandwidth) lines.push(`Bandwidth limit: ${this.limitBandwidth}`);
    if (this.limitNumClients) lines.push(`Client limit: ${this.limitNumClients}`);
    if (this.dateRangeFrom) lines.push(`Valid from: ${this.dateRangeFrom}`);
    if (this.dateRangeTo) lines.push(`Valid until: ${this.dateRangeTo}`);
    if (this.metadata) lines.push(`Metadata: ${JSON.stringify(this.metadata)}`);
    return lines.join('\n');
  }
}
```

### Modifications

#### `models/repositoryNode.js`

Add entitlement fetching alongside upstream fetching. In `getChildren()`, if the `cloudsmith-vsc.showEntitlements` setting is true, fetch entitlements for the repo and prepend `EntitlementNode` instances (after the upstream indicator, before packages).

```javascript
async getEntitlements() {
  const result = await cloudsmithAPI.get(
    `entitlements/${workspace}/${repo}/?page_size=50&active=true`
  );
  // Return array of EntitlementNode instances
}
```

### Settings

```json
"cloudsmith-vsc.showEntitlements": {
  "type": "boolean",
  "default": false,
  "description": "Show entitlement tokens under each repository. Useful for debugging access issues."
}
```

Default false because most developers don't need this — it's a platform/debugging tool. But when you need it, you really need it.

---

## Phase 13: Repository Storage and Bandwidth Metrics

### Goal

Show lightweight usage indicators on each repository — total size, download trends, storage quota percentage. Gives engineering managers and platform teams visibility without leaving the IDE.

### New Files

#### `models/repoMetricsNode.js`

Tree node showing repo metrics, appears at the top of a repo's package list (alongside the upstream indicator and entitlements).

```javascript
class RepoMetricsNode {
  constructor(quotaData, packageMetrics) {
    this.quota = quotaData;
    this.metrics = packageMetrics;
  }

  getTreeItem() {
    const storage = this.quota?.usage?.display?.storage;
    const bandwidth = this.quota?.usage?.display?.bandwidth;

    let label = "Usage";
    let description = "";
    if (storage) {
      description += `Storage: ${storage.used} / ${storage.plan_limit}`;
    }

    return {
      label: label,
      description: description,
      tooltip: this._buildTooltip(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "repoMetrics",
      iconPath: new vscode.ThemeIcon('graph'),
    };
  }

  _buildTooltip() {
    const lines = [];
    const s = this.quota?.usage?.display?.storage;
    const b = this.quota?.usage?.display?.bandwidth;
    if (s) lines.push(`Storage: ${s.used} of ${s.plan_limit} (${s.percentage_used})`);
    if (b) lines.push(`Bandwidth: ${b.used} of ${b.plan_limit} (${b.percentage_used})`);
    return lines.join('\n');
  }
}
```

### Modifications

#### `models/repositoryNode.js`

Add metrics fetching. In `getChildren()`, if `cloudsmith-vsc.showRepoMetrics` is true, fetch quota and prepend a `RepoMetricsNode`.

Note: The quota endpoint (`/v1/quota/{owner}/`) is workspace-level, not repo-level. Cache this result across all repos in the same workspace to avoid redundant calls. The package metrics endpoint (`/v1/metrics/packages/{owner}/{repo}/`) is repo-level and gives per-repo download data.

### Settings

```json
"cloudsmith-vsc.showRepoMetrics": {
  "type": "boolean",
  "default": false,
  "description": "Show storage and bandwidth usage indicators on repositories."
}
```

Default false — opt-in for the same reason as entitlements. Most developers don't need it daily.

---

## File Summary: Phases 9-13

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `views/upstreamPreviewProvider.js` | 9 | WebView for upstream resolution preview |
| `util/upstreamChecker.js` | 9 | Upstream resolution + policy simulation logic |
| `views/promotionProvider.js` | 10 | Promotion status and cross-repo visibility |
| `models/promotionStatusNode.js` | 10 | Promotion status tree node |
| `models/entitlementNode.js` | 12 | Entitlement token tree node |
| `models/repoMetricsNode.js` | 13 | Repository metrics tree node |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `package.json` | 9-13 | New commands, settings, menus |
| `extension.js` | 9-13 | Register providers and commands |
| `util/cloudsmithAPI.js` | 11 | Add `getV2()` method for v2 API endpoints |
| `views/vulnerabilityProvider.js` | 11 | Add policy decision trace section to WebView |
| `models/repositoryNode.js` | 12-13 | Fetch entitlements and metrics in getChildren() |

### CloudsmithAPI v2 Support

Phase 11 requires calling the v2 API (`/v2/workspaces/{workspace}/policies/decision/logs/`). Add a `getV2(endpoint)` method to `CloudsmithAPI` that uses `https://api.cloudsmith.io/v2/` as the base URL. Same auth headers, same error handling, just different base path. This is also needed for Phase 9's policy simulation endpoint.
