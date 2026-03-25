
## 2.0.0 - March 2026
### Package Intelligence Platform

This release transforms the extension from a basic package explorer into a full package intelligence platform with security remediation, dependency health scanning, license compliance, and cross-repository promotion workflows.

#### Package Search
- Full-text package search across workspaces and repositories with Cloudsmith query syntax support.
- Guided multi-step search with filter presets for quarantined packages, policy violations, vulnerability violations, and license violations.
- Recent search history with one-click re-run.
- Per-repository filtering from the main tree view context menu.
- Paginated search results with "Load More" support.

#### Permissibility Indicators
- Visual status icons on all packages: error icons for quarantined/deny-violated, warning icons for non-deny policy violations, sync icons for packages still processing.
- Quarantine status shown in package descriptions.
- Policy violation details (EPM and legacy classic policies) as expandable child nodes under each package.
- Configurable via `showPermissibilityIndicators` and `showLegacyPolicies` settings.

#### Upstream Awareness
- Upstream proxy/cache indicator shown at the top of repositories with configured upstreams.
- Package origin detection — packages cached from upstreams are tagged with "(via upstream)" in the tree view.
- Origin detail node showing "Direct" or "Upstream: {name}" for each package.
- Lazy-loaded upstream config fetching with 10-minute cache to minimize API calls.

#### Vulnerability Details & Remediation
- Inline vulnerability summary under each package showing CVE count and max severity.
- Expandable vulnerability nodes with CVE ID, severity, CVSS score, and fix version.
- Full vulnerability detail WebView panel with severity badges, CVSS scores, fix availability, and the quarantine reason from Cloudsmith's policy engine.
- Two-step API chain support for fetching scan metadata and detailed CVE results.
- "Find Safe Version" command that searches for clean, non-quarantined versions of a package within the same repo or across the workspace.
- "Open CVE" command to view CVE details on NVD or GitHub Advisories.
- "Copy CVE Report" for pasting vulnerability summaries into issue trackers.

#### Dependency Health View
- New sidebar view that reads project manifest files and cross-references declared dependencies against Cloudsmith.
- Supported manifest formats: package.json (npm), requirements.txt (Python), pyproject.toml (Python), pom.xml (Maven), go.mod (Go), Cargo.toml (Rust).
- Dependencies shown with status: available, quarantined, policy violated, not found, or syncing.
- Batch OR queries to minimize API calls (groups of 5 dependencies per request).
- Progressive results — tree updates as each batch completes.
- Optional transitive dependency resolution via package manager CLI (`resolveTransitiveDependencies` setting).
- Auto-scan on workspace open when configured (`autoScanOnOpen` setting).
- Inline editor diagnostics — squiggly underlines on vulnerable dependencies in manifest files.

#### Install Commands
- "Copy Install Command" generates format-native install commands with Cloudsmith registry URLs for 12+ package formats: pip, npm, maven, nuget, docker, helm, cargo, go, ruby, conda, composer, and dart.
- "Show Install Command" opens multi-line commands (e.g., Maven pom.xml snippets) in a new document for review before copying.
- Private repository authentication notes included with each command.
- Integrated into the "Find Safe Version" remediation workflow — selecting a safe version copies the install command directly.

#### License Visibility & Risk Classification
- License risk classification with three tiers: Permissive, Cautious, and Restrictive.
- License node shown under each package with color-coded shield icons.
- Built-in SPDX classification for 40+ common licenses including compound expression support (e.g., "MIT OR GPL-3.0" classified by most restrictive component).
- Configurable restrictive license list via `restrictiveLicenses` setting for enterprise legal policy alignment.
- "Search by License" command for finding all packages with a specific license type.

#### Upstream Proxy Resolution Preview
- "Preview Upstream Resolution" command shows what would happen if a missing package were pulled through an upstream proxy.
- WebView panel displaying local status, active upstreams for the package format, and applicable policy preview.

#### Cross-Repository Promotion
- Configurable promotion pipeline via `promotionPipeline` setting (e.g., dev → staging → production).
- "Show Promotion Status" displays pipeline visualization with per-repo status for a package version.
- "Promote Package" performs one-click copy to the next pipeline stage with automatic tag application.
- Tag templates with `{target}`, `{source}`, and `{date}` placeholders via `promotionTags` setting.

#### Quarantine Policy Trace
- Enhanced vulnerability WebView shows which specific policy quarantined a package and why.
- Policy decision log integration via the Cloudsmith v2 API.
- Displays policy name, matched status, and actions taken.

#### Entitlement Token Visibility
- Optional display of active entitlement tokens under each repository (`showEntitlements` setting).
- Summary node showing active vs. total token count.
- "Copy Entitlement Token" command for quick access to token strings.

#### Repository Metrics
- Optional storage and bandwidth usage indicators on repositories (`showRepoMetrics` setting).
- Workspace quota display with pre-formatted values from the Cloudsmith API.

#### Default Workspace
- New `defaultWorkspace` setting that skips the workspace tree level for single-workspace users.
- Tree view title dynamically updates to "Repositories" when a default is set.
- "Set Default Workspace" command with QuickPick selection.
- Auto-suggest when connecting to a single-workspace account.
- All workspace-scoped commands (search, guided search, dependency scan) automatically use the default when set.

#### Authentication
- New credential setup QuickPick with four authentication methods: API Key, Service Account Token, Import from Cloudsmith CLI, and Sign in with SSO.
- CLI credential import reads API keys from `~/.cloudsmith/config.ini` with cross-platform path detection.
- SSO terminal flow opens an integrated terminal to run `cloudsmith auth -o {workspace}` for interactive SAML/2FA authentication.
- Auto-detect CLI credentials on extension activation with prompt to import.
- Experimental browser-based SSO flow (gated behind `experimentalSSOBrowser` setting).

#### Testing
- Integration test suite running against the live Cloudsmith API.
- Tests for search, vulnerability API chain, install command generation, license classification, and manifest parsing.
- Integration tests automatically skipped when `CLOUDSMITH_TEST_API_KEY` is not set.

## 1.0.1 - 3rd Sept 2025

- Added support for Cursor IDE. Install the extension via the vsix file. 
- Updated Cloudsmith documentation links to the new website. 

## 1.0.0 - July 2025
### Initial release

- Initial release of the Cloudsmith extension. The extension in this releases provides a package explorer for your Cloudsmith instance.
- Future releases will continue to build upon this with futher capabilities and features. 


