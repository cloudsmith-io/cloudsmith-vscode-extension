# Implementation Plan V2 - Phases 5-8

Continues from [IMPLEMENTATION.md](./IMPLEMENTATION.md) (Phases 1-4). See [API_REFERENCE_V2.md](./API_REFERENCE_V2.md) for all new API endpoints referenced here.

## Phase Overview

| Phase | Scope | Complexity | Dependencies |
|-------|-------|------------|-------------|
| 5 | Vulnerability details + remediation | Medium-High | Phases 1-2 |
| 6 | Dependency health view from project manifests | High | Phases 1-2 |
| 7 | Copy install commands | Low | Phase 1 |
| 8 | License visibility + risk classification | Medium | Phases 1-2 |

Each phase is independently shippable. Phase 7 is the quickest win and can be done in any order after Phase 1.

---

## Phase 5: Vulnerability Details + Remediation

### Goal

When a developer sees a quarantined or policy-violated package, give them actionable information without leaving VS Code: what CVEs affect it, how severe they are, whether a fix exists, and what clean version to use instead.

### New Files

#### `models/vulnerabilityNode.js`

A tree node representing a single CVE. Appears as a child of a package when the user expands vulnerability details.

```javascript
class VulnerabilityNode {
  constructor(vuln, context) {
    this.context = context;
    this.cveId = vuln.VulnerabilityID;       // e.g., "CVE-2024-1234"
    this.severity = vuln.severity;            // "Critical", "High", etc.
    this.cvssScore = vuln.CVSS?.V3Score;      // 9.8
    this.epssScore = vuln.epss?.score;        // 0.94
    this.status = vuln.Status;                // "fixed" or "affected"
    this.fixedVersion = vuln.FixedVersion;    // "2.3.3" or null
    this.installedVersion = vuln.InstalledVersion;
    this.description = vuln.description;
    this.publishedDate = vuln.PublishedDate;
  }

  getTreeItem() {
    // Label: "CVE-2024-1234 (Critical, CVSS 9.8)"
    // Description: "Fix available: 2.3.3" or "No fix available"
    // Icon: color-coded by severity
    //   - Critical: ThemeIcon('error') with errorForeground
    //   - High: ThemeIcon('warning') with editorWarning.foreground
    //   - Medium: ThemeIcon('info') with editorInfo.foreground
    //   - Low: ThemeIcon('info')
    // Tooltip: full description + EPSS score + published date
    // contextValue: "vulnerability" (for context menu actions)
  }

  getChildren() { return []; } // leaf node
}
```

#### `models/vulnerabilitySummaryNode.js`

A collapsible summary node that sits under a package and lazy-loads vulnerability details on expand.

```javascript
class VulnerabilitySummaryNode {
  constructor(pkg, context) {
    this.context = context;
    this.workspace = pkg.namespace;
    this.repo = pkg.repository;
    this.slugPerm = pkg.slug_perm;
    this.numVulns = pkg.num_vulnerabilities;
    this.maxSeverity = pkg.max_severity;
    this.vulnerabilities = null; // lazy loaded
  }

  getTreeItem() {
    // Label: "Vulnerabilities: 3 found (Critical)"
    // Icon based on max_severity
    // Collapsible: yes (loads on expand)
  }

  async getChildren() {
    if (!this.vulnerabilities) {
      // GET /v1/vulnerabilities/{owner}/{repo}/{slugPerm}/
      // Parse response, create VulnerabilityNode for each
    }
    return this.vulnerabilities;
  }
}
```

#### `util/remediationHelper.js`

Logic for finding safe alternative versions of a package.

```javascript
class RemediationHelper {
  constructor(cloudsmithAPI) {
    this.api = cloudsmithAPI;
  }

  // Search for clean versions of the same package
  // Returns array of { version, status, policyClean } sorted by version desc
  async findSafeVersions(workspace, repo, packageName, format) {
    const query = `name:^${packageName}$ AND format:${format} AND NOT status:quarantined AND deny_policy_violated:false`;
    const results = await this.api.get(
      `packages/${workspace}/${repo}/?query=${encodeURIComponent(query)}&sort=-version&page_size=10`
    );
    return results;
  }

  // Search workspace-wide for the same package in any repo
  async findSafeVersionsAcrossRepos(workspace, packageName, format) {
    const query = `name:^${packageName}$ AND format:${format} AND NOT status:quarantined AND deny_policy_violated:false`;
    const results = await this.api.get(
      `packages/${workspace}/?query=${encodeURIComponent(query)}&sort=-version&page_size=10`
    );
    return results;
  }
}

module.exports = { RemediationHelper };
```

### New Commands

#### `cloudsmith-vsc.showVulnerabilities`

Context menu on package nodes. Fetches vulnerability scan results and shows them as an expandable tree under the package, or opens a dedicated output panel if the list is long.

#### `cloudsmith-vsc.findSafeVersion`

Context menu on quarantined/violated package nodes. Runs the remediation search and shows results in a QuickPick:

```
Safe versions of "flask" (python) in my-repo:
  ✓ 3.0.3  (Completed, no violations)
  ✓ 3.0.2  (Completed, no violations)
  ✓ 2.3.8  (Completed, no violations)
  ⚠ 2.3.5  (Completed, license violation)

Select a version to copy install command or view details.
```

Selecting a version either copies the install command (Phase 7) or opens the package in the browser.

#### `cloudsmith-vsc.openCVE`

Context menu on vulnerability nodes. Opens the CVE in the browser:
- `https://nvd.nist.gov/vuln/detail/{CVE-ID}` for CVEs
- `https://github.com/advisories/{GHSA-ID}` for GHSAs

### Modifications to Existing Files

#### `models/packageNode.js`

- Capture `num_vulnerabilities`, `max_severity`, and `vulnerability_scan_results_url` from the API response.
- Add a `VulnerabilitySummaryNode` as a child when `num_vulnerabilities > 0`.
- The vulnerability summary appears alongside existing detail nodes (status, version, tags, etc.).

#### `package.json`

- Add new commands: `showVulnerabilities`, `findSafeVersion`, `openCVE`
- Add context menu entries for `viewItem == package` and `viewItem == packageQuarantined`
- Add context menu entry for `viewItem == vulnerability` (openCVE)

#### `extension.js`

- Register new commands
- Wire up `RemediationHelper`

---

## Phase 6: Dependency Health View from Project Manifests

### Goal

Read the active VS Code workspace's dependency manifest files, cross-reference declared dependencies against Cloudsmith, and surface a "Dependency Health" view showing the status of every dependency. This is what makes the extension a daily-open tool instead of an occasional browser.

### New Files

#### `util/manifestParser.js`

Parses dependency manifest files from the VS Code workspace. Supports the most common formats.

```javascript
class ManifestParser {
  // Detect which manifest files exist in the workspace
  static async detectManifests(workspaceFolder) {
    const manifests = [];
    const checks = [
      { file: 'package.json', format: 'npm', parser: 'parseNpm' },
      { file: 'requirements.txt', format: 'python', parser: 'parsePythonRequirements' },
      { file: 'Pipfile', format: 'python', parser: 'parsePipfile' },
      { file: 'pyproject.toml', format: 'python', parser: 'parsePyproject' },
      { file: 'pom.xml', format: 'maven', parser: 'parseMaven' },
      { file: 'build.gradle', format: 'maven', parser: 'parseGradle' },
      { file: 'go.mod', format: 'go', parser: 'parseGoMod' },
      { file: 'Cargo.toml', format: 'cargo', parser: 'parseCargo' },
      { file: 'Gemfile', format: 'ruby', parser: 'parseGemfile' },
      { file: '*.csproj', format: 'nuget', parser: 'parseCsproj' },
      { file: 'composer.json', format: 'composer', parser: 'parseComposer' },
      { file: 'environment.yml', format: 'conda', parser: 'parseCondaEnv' },
    ];
    // Check each, return found manifests with their parser function
    return manifests;
  }

  // Each parser returns array of { name, version, devDependency: bool }
  static parseNpm(content) { /* parse package.json dependencies + devDependencies */ }
  static parsePythonRequirements(content) { /* parse requirements.txt lines */ }
  static parseMaven(content) { /* parse pom.xml <dependency> blocks */ }
  static parseGoMod(content) { /* parse require blocks */ }
  static parseCargo(content) { /* parse [dependencies] section */ }
  // ... etc
}

module.exports = { ManifestParser };
```

**Implementation notes:**
- Parse `package.json` with `JSON.parse()` (trivial).
- Parse `requirements.txt` line by line, handle `==`, `>=`, `~=` operators and comments.
- Parse `pom.xml` and `*.csproj` with regex or a lightweight XML approach (no dependency). These formats are structured enough that regex on `<groupId>`, `<artifactId>`, `<version>` works reliably.
- Parse `go.mod` line by line from the `require` block.
- Parse `Cargo.toml` and `pyproject.toml` with basic TOML parsing (key = "value" lines). For complex cases, fall back to regex.
- Don't try to be perfect. Cover the 80% case for each format. If a manifest can't be parsed, show a warning and skip it.

#### `views/dependencyHealthProvider.js`

New `TreeDataProvider` for the Dependency Health view.

```javascript
class DependencyHealthProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.dependencies = [];
    this.workspace = null; // selected Cloudsmith workspace
    this.repo = null;      // selected Cloudsmith repo (or null for workspace-wide)
  }

  // Scan the VS Code workspace for manifests and cross-reference
  async scan(cloudsmithWorkspace, cloudsmithRepo) {
    // 1. Detect manifests in the active VS Code workspace
    // 2. Parse dependencies from each manifest
    // 3. For each dependency, search Cloudsmith:
    //    GET /v1/packages/{workspace}/{repo}/?query=name:^{name}$&sort=-version&page_size=1
    //    OR workspace-wide if no repo specified
    // 4. Build DependencyHealthNode for each
    // 5. Sort: blocked first, then warnings, then clean
  }

  // TreeDataProvider interface
  getTreeItem(element) { return element.getTreeItem(); }
  getChildren(element) { /* ... */ }
  refresh() { this._onDidChangeTreeData.fire(); }
}
```

#### `models/dependencyHealthNode.js`

Tree node for each dependency found in the project.

```javascript
class DependencyHealthNode {
  constructor(dep, cloudsmithResult, context) {
    this.name = dep.name;
    this.declaredVersion = dep.version;     // from manifest
    this.format = dep.format;
    this.isDev = dep.devDependency;
    this.cloudsmithMatch = cloudsmithResult; // package from Cloudsmith or null
    // Derived state:
    // - "available" = found in Cloudsmith, not quarantined, no deny violations
    // - "quarantined" = found but quarantined
    // - "violated" = found but has policy violations
    // - "not_found" = not in Cloudsmith (may need upstream fetch)
    // - "version_mismatch" = found but declared version doesn't match
  }

  getTreeItem() {
    // Label: "flask 3.0.0"
    // Description based on state:
    //   - "✓ Available" (green check)
    //   - "⛔ Quarantined" (red error)
    //   - "⚠ Policy violation" (yellow warning)
    //   - "? Not found in Cloudsmith" (grey question)
    //   - "↑ Version mismatch: latest is 3.0.3" (blue info)
    // Icon: color-coded ThemeIcon matching state
    // contextValue: "dependencyHealth" or "dependencyHealthBlocked"
  }

  getChildren() {
    // If cloudsmithMatch exists, show key details:
    // - Status, policy state, license, vulnerability count
    // If not found, show helpful message about upstream/manual upload
    return [];
  }
}
```

### New Commands

#### `cloudsmith-vsc.scanDependencies`

Main entry point. Shows QuickPick to select Cloudsmith workspace (and optionally repo), then runs the scan. Results populate the Dependency Health view.

#### `cloudsmith-vsc.rescanDependencies`

Re-runs the last scan with the same settings. Title bar button on the Dependency Health view.

#### `cloudsmith-vsc.scanDependencyDetail`

Context menu on a dependency health node. If the package exists in Cloudsmith, fetches full package detail and shows it (reuse inspect pattern). If not found, offers to search Cloudsmith for it.

### Modifications to Existing Files

#### `package.json`

Add a new view to the sidebar:

```json
{
  "id": "cloudsmithDependencyHealthView",
  "name": "Dependency Health"
}
```

Add commands, menus, and a setting:

```json
{
  "cloudsmith-vsc.autoScanOnOpen": {
    "type": "boolean",
    "default": false,
    "description": "Automatically scan project dependencies against Cloudsmith when a workspace is opened. Requires a configured Cloudsmith workspace."
  },
  "cloudsmith-vsc.dependencyScanWorkspace": {
    "type": "string",
    "default": "",
    "description": "Cloudsmith workspace slug to use for dependency health scanning. Leave empty to be prompted each time."
  },
  "cloudsmith-vsc.dependencyScanRepo": {
    "type": "string",
    "default": "",
    "description": "Cloudsmith repository slug to use for dependency health scanning. Leave empty for workspace-wide search."
  }
}
```

#### `extension.js`

- Register `DependencyHealthProvider` and its tree view
- Register scan commands
- If `autoScanOnOpen` is true and credentials are configured, trigger a scan on activation

### Rate Limit Considerations

A project with 50 dependencies would generate 50 API calls if done naively. Mitigations:

1. **Batch by searching with OR queries.** Combine up to 5 package names per query: `(name:^flask$ OR name:^werkzeug$ OR name:^jinja2$ OR name:^click$ OR name:^itsdangerous$)`. This reduces 50 deps to ~10 API calls.
2. **Cache results.** Store in `globalState` with a 10-minute TTL keyed by workspace + dep name + version.
3. **Show progressive results.** Don't wait for all deps to resolve. Push nodes to the tree as each batch completes so the user sees results streaming in.
4. **Respect rate limit headers.** If a 429 comes back, pause and show a "Rate limited, resuming in Xs" status.

---

## Phase 7: Copy Install Commands

### Goal

One-click copy of the correct, format-native install command with the Cloudsmith registry URL pre-filled. This is a small quality-of-life feature that eliminates context-switching to the Cloudsmith web UI for setup instructions.

### New Files

#### `util/installCommandBuilder.js`

Generates install commands based on package format, name, version, workspace, and repo.

```javascript
class InstallCommandBuilder {
  // Returns { command: string, note: string|null }
  // command = the copy-paste-ready install command
  // note = optional auth reminder or setup instruction
  static build(format, name, version, workspace, repo) {
    const commands = {
      python: {
        command: `pip install ${name}==${version} --index-url https://dl.cloudsmith.io/basic/${workspace}/${repo}/python/simple/`,
        note: 'For private repos, replace "basic" with your entitlement token.'
      },
      npm: {
        command: `npm install ${name}@${version} --registry=https://npm.cloudsmith.io/${workspace}/${repo}/`,
        note: 'Run `npm login --registry=...` first for private repos.'
      },
      maven: {
        command: `<!-- Add to pom.xml repositories -->\n<repository>\n  <id>cloudsmith-${repo}</id>\n  <url>https://dl.cloudsmith.io/basic/${workspace}/${repo}/maven/</url>\n</repository>\n\n<!-- Add to dependencies -->\n<dependency>\n  <groupId>${name.split(':')[0] || name}</groupId>\n  <artifactId>${name.split(':')[1] || name}</artifactId>\n  <version>${version}</version>\n</dependency>`,
        note: null
      },
      nuget: {
        command: `dotnet add package ${name} --version ${version} --source https://nuget.cloudsmith.io/${workspace}/${repo}/v3/index.json`,
        note: null
      },
      docker: {
        command: `docker pull docker.cloudsmith.io/${workspace}/${repo}/${name}:${version}`,
        note: 'Run `docker login docker.cloudsmith.io` first for private repos.'
      },
      helm: {
        command: `helm install ${name} --repo https://dl.cloudsmith.io/basic/${workspace}/${repo}/helm/charts/ --version ${version}`,
        note: null
      },
      cargo: {
        command: `cargo add ${name}@${version}`,
        note: `Add registry to .cargo/config.toml:\n[registries.cloudsmith]\nindex = "sparse+https://cargo.cloudsmith.io/${workspace}/${repo}/"`
      },
      go: {
        command: `GONOSUMCHECK=${name} go get ${name}@v${version}`,
        note: `Set GOPROXY=https://go.cloudsmith.io/basic/${workspace}/${repo}/,direct`
      },
      ruby: {
        command: `gem install ${name} -v ${version} --source https://dl.cloudsmith.io/basic/${workspace}/${repo}/ruby/`,
        note: null
      },
      conda: {
        command: `conda install -c https://conda.cloudsmith.io/${workspace}/${repo}/ ${name}=${version}`,
        note: null
      },
      dart: {
        command: `dart pub add ${name}:${version}`,
        note: `Add hosted URL to pubspec.yaml:\n  ${name}:\n    hosted: https://dart.cloudsmith.io/basic/${workspace}/${repo}/pub/\n    version: ${version}`
      },
      composer: {
        command: `composer require ${name}:${version}`,
        note: `Add repository to composer.json:\n{"type": "composer", "url": "https://composer.cloudsmith.io/${workspace}/${repo}/"}`
      },
    };

    const entry = commands[format];
    if (!entry) {
      return {
        command: `# No install command template for format: ${format}`,
        note: `Visit https://app.cloudsmith.com/${workspace}/${repo} for setup instructions.`
      };
    }
    return entry;
  }
}

module.exports = { InstallCommandBuilder };
```

### New Commands

#### `cloudsmith-vsc.copyInstallCommand`

Context menu on package nodes and search result nodes. Generates the install command, copies it to clipboard, and shows an info message. If a `note` exists, include it in the message.

```javascript
vscode.commands.registerCommand("cloudsmith-vsc.copyInstallCommand", async (item) => {
  const { InstallCommandBuilder } = require("./util/installCommandBuilder");
  const result = InstallCommandBuilder.build(
    item.format, item.name, item.version.value.value,
    item.namespace, item.repository
  );
  await vscode.env.clipboard.writeText(result.command);
  let msg = `Install command copied for ${item.name}`;
  if (result.note) {
    msg += ` — Note: ${result.note}`;
  }
  vscode.window.showInformationMessage(msg);
});
```

#### `cloudsmith-vsc.showInstallCommand`

Same as above but opens the command in a new text document instead of clipboard, for multi-line commands (like Maven pom.xml snippets) that benefit from viewing before copying.

### Modifications to Existing Files

#### `package.json`

Add commands and context menu entries:

```json
{
  "command": "cloudsmith-vsc.copyInstallCommand",
  "title": "Copy install command",
  "icon": "$(terminal)"
}
```

Context menu on packages, search results, and dependency health nodes:

```json
{
  "command": "cloudsmith-vsc.copyInstallCommand",
  "when": "view == cloudsmithView && viewItem == package",
  "group": "navigation"
},
{
  "command": "cloudsmith-vsc.copyInstallCommand",
  "when": "view == cloudsmithSearchView && viewItem =~ /searchResult|package/",
  "group": "navigation"
},
{
  "command": "cloudsmith-vsc.copyInstallCommand",
  "when": "view == cloudsmithDependencyHealthView && viewItem =~ /dependencyHealth/",
  "group": "navigation"
}
```

---

## Phase 8: License Visibility + Risk Classification

### Goal

Surface license information on all packages with visual risk classification. Flag restrictive licenses (AGPL, GPL, SSPL, EUPL, etc.) so developers and legal teams can spot compliance issues before introducing a dependency.

### New Files

#### `util/licenseClassifier.js`

Classifies SPDX license identifiers into risk tiers.

```javascript
class LicenseClassifier {
  // Risk tiers:
  // "restrictive" - Strong copyleft, viral, or problematic for commercial use
  // "cautious" - Weak copyleft or uncommon licenses requiring review
  // "permissive" - Generally safe for commercial use
  // "unknown" - Unrecognized or missing license

  static RESTRICTIVE = new Set([
    'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
    'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
    'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
    'SSPL-1.0',
    'EUPL-1.1', 'EUPL-1.2',
    'OSL-3.0',
    'CPAL-1.0',
    'CC-BY-SA-4.0',
    'Sleepycat',
  ]);

  static CAUTIOUS = new Set([
    'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
    'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
    'MPL-2.0',
    'EPL-1.0', 'EPL-2.0',
    'CDDL-1.0', 'CDDL-1.1',
    'CPL-1.0',
    'Artistic-2.0',
    'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0',
  ]);

  static PERMISSIVE = new Set([
    'MIT', 'MIT-0',
    'Apache-2.0',
    'BSD-2-Clause', 'BSD-3-Clause',
    'ISC',
    'Unlicense',
    'CC0-1.0',
    '0BSD',
    'BSL-1.0',
    'Zlib',
    'PSF-2.0',
    'Python-2.0',
    'CC-BY-4.0',
  ]);

  static classify(license) {
    if (!license) return { tier: 'unknown', label: 'No license specified', icon: 'question' };

    // Normalize: trim whitespace, handle SPDX expressions
    const normalized = license.trim();

    // Check for SPDX compound expressions (e.g., "MIT OR Apache-2.0")
    // For compound, classify based on the most restrictive component
    const parts = normalized.split(/\s+OR\s+|\s+AND\s+/i);

    let worstTier = 'permissive';
    for (const part of parts) {
      const clean = part.trim().replace(/[()]/g, '');
      if (this.RESTRICTIVE.has(clean)) return { tier: 'restrictive', label: license, icon: 'error' };
      if (this.CAUTIOUS.has(clean)) worstTier = 'cautious';
    }

    if (worstTier === 'cautious') return { tier: 'cautious', label: license, icon: 'warning' };

    // Check permissive set
    for (const part of parts) {
      const clean = part.trim().replace(/[()]/g, '');
      if (this.PERMISSIVE.has(clean)) return { tier: 'permissive', label: license, icon: 'check' };
    }

    // Not in any known set
    return { tier: 'unknown', label: license, icon: 'question' };
  }
}

module.exports = { LicenseClassifier };
```

#### `models/licenseNode.js`

A detail node showing the license with risk-tier coloring.

```javascript
class LicenseNode {
  constructor(license, licenseUrl, context) {
    this.license = license;
    this.licenseUrl = licenseUrl;
    this.context = context;
    this.classification = LicenseClassifier.classify(license);
  }

  getTreeItem() {
    const iconMap = {
      'restrictive': new vscode.ThemeIcon('shield', new vscode.ThemeColor('errorForeground')),
      'cautious': new vscode.ThemeIcon('shield', new vscode.ThemeColor('editorWarning.foreground')),
      'permissive': new vscode.ThemeIcon('shield', new vscode.ThemeColor('testing.iconPassed')),
      'unknown': new vscode.ThemeIcon('shield', new vscode.ThemeColor('descriptionForeground')),
    };

    const tierLabel = {
      'restrictive': '⛔ Restrictive',
      'cautious': '⚠ Review required',
      'permissive': '✓ Permissive',
      'unknown': '? Unknown license',
    };

    return {
      label: `License: ${this.license || 'Not specified'}`,
      description: tierLabel[this.classification.tier],
      tooltip: this._buildTooltip(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "licenseDetail",
      iconPath: iconMap[this.classification.tier],
      command: this.licenseUrl ? {
        command: 'vscode.open',
        title: 'View License',
        arguments: [vscode.Uri.parse(this.licenseUrl)]
      } : undefined
    };
  }

  _buildTooltip() {
    const tips = {
      'restrictive': 'This license has strong copyleft or viral terms that may require releasing derivative works under the same license. Legal review recommended before use in commercial software.',
      'cautious': 'This license has weak copyleft or uncommon terms. Review the specific obligations before use.',
      'permissive': 'This license is generally compatible with commercial use with minimal obligations.',
      'unknown': 'This license was not recognized. Review the license text manually.',
    };
    return `${this.license}\n\n${tips[this.classification.tier]}`;
  }

  getChildren() { return []; }
}
```

### Modifications to Existing Files

#### `models/packageNode.js`

- Capture `license` and `license_url` fields from the API response.
- **Note:** The packages list endpoint may not include these fields (they may only be on the detail endpoint). If so, the license node should lazy-load: show "License: loading..." initially, and when expanded or when the package detail is fetched for another reason (e.g., inspect), populate the real value.
- Add a `LicenseNode` to `pkgDetails` children.

#### `models/searchResultNode.js`

Same license node integration as `packageNode.js`.

#### `models/dependencyHealthNode.js` (from Phase 6)

Include license info in the dependency health view. When a Cloudsmith match is found, show the license classification alongside the availability status.

#### `package.json`

Add a new guided search filter preset for license searching:

```json
// In the Phase 4 guidedSearch filter presets, add:
"Packages with restrictive licenses (AGPL, GPL, SSPL)"
// builds query: license:AGPL OR license:GPL OR license:SSPL
```

Add new settings:

```json
{
  "cloudsmith-vsc.showLicenseIndicators": {
    "type": "boolean",
    "default": true,
    "description": "Show license risk classification on packages."
  },
  "cloudsmith-vsc.restrictiveLicenses": {
    "type": "array",
    "default": ["AGPL-3.0", "GPL-3.0", "GPL-2.0", "SSPL-1.0"],
    "description": "SPDX identifiers to treat as restrictive. Packages with these licenses will be flagged."
  }
}
```

The `restrictiveLicenses` setting lets enterprises customize which licenses their legal team considers problematic, overriding the built-in classification.

### New Commands

#### `cloudsmith-vsc.searchByLicense`

Searches for all packages with a specific license across the workspace. Shows a QuickPick of common license types, then runs a search with `query=license:{selected}`.

#### `cloudsmith-vsc.openLicenseUrl`

Context menu on license nodes. Opens the license URL in the browser.

---

## File Summary: New and Modified Files (Phases 5-8)

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `models/vulnerabilityNode.js` | 5 | Individual CVE tree item |
| `models/vulnerabilitySummaryNode.js` | 5 | Collapsible vuln summary under packages |
| `util/remediationHelper.js` | 5 | Find safe alternative versions |
| `util/manifestParser.js` | 6 | Parse project dependency manifests |
| `views/dependencyHealthProvider.js` | 6 | Dependency health tree provider |
| `models/dependencyHealthNode.js` | 6 | Individual dependency status node |
| `util/installCommandBuilder.js` | 7 | Generate format-native install commands |
| `util/licenseClassifier.js` | 8 | SPDX license risk classification |
| `models/licenseNode.js` | 8 | License detail tree item |
| `test/installCommandBuilder.test.js` | 7 | Tests for install command generation |
| `test/licenseClassifier.test.js` | 8 | Tests for license classification |
| `test/manifestParser.test.js` | 6 | Tests for manifest parsing |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `models/packageNode.js` | 5, 8 | Add vuln summary + license children, capture new fields |
| `models/searchResultNode.js` | 5, 7, 8 | Same vuln/license integration, install command context menu |
| `package.json` | 5-8 | New commands, views, menus, settings |
| `extension.js` | 5-8 | Register providers and commands |
