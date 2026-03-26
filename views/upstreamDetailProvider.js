const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");

const SUPPORTED_FORMATS = [
  "deb", "docker", "maven", "npm", "python",
  "ruby", "dart", "helm", "nuget", "cargo",
  "rpm", "cran", "swift", "go", "hex",
  "composer", "conda", "conan", "p2", "terraform",
  "raw",
];
const FETCH_BATCH_SIZE = 5;

class UpstreamDetailProvider {
  constructor(context) {
    this.context = context;
    this._panel = null;
    this._requestId = 0;
  }

  async show(workspace, repoSlug, repoName) {
    if (!workspace || !repoSlug || !repoName) {
      vscode.window.showWarningMessage("Could not determine repository details for upstream inspection.");
      return;
    }

    const panel = this._getOrCreatePanel(repoName);
    const requestId = ++this._requestId;
    panel.title = `Upstreams: ${repoName}`;
    panel.webview.html = this._getLoadingHtml(workspace, repoSlug, repoName);

    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const groupedUpstreams = await this._fetchGroupedUpstreams(cloudsmithAPI, workspace, repoSlug);

    if (this._panel !== panel || this._requestId !== requestId) {
      return;
    }

    panel.title = `Upstreams: ${repoName}`;
    panel.webview.html = this._getHtmlContent(workspace, repoSlug, repoName, groupedUpstreams);
  }

  _getOrCreatePanel(repoName) {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      return this._panel;
    }

    const panel = vscode.window.createWebviewPanel(
      "cloudsmithUpstreams",
      `Upstreams: ${repoName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        localResourceRoots: [],
      }
    );

    panel.onDidDispose(() => {
      if (this._panel === panel) {
        this._panel = null;
      }
    });

    this._panel = panel;
    return panel;
  }

  async _fetchGroupedUpstreams(cloudsmithAPI, workspace, repoSlug) {
    const grouped = new Map();

    for (let index = 0; index < SUPPORTED_FORMATS.length; index += FETCH_BATCH_SIZE) {
      const batch = SUPPORTED_FORMATS.slice(index, index + FETCH_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((format) => this._fetchFormatUpstreams(cloudsmithAPI, workspace, repoSlug, format))
      );

      for (const result of batchResults) {
        if (result.length === 0) {
          continue;
        }
        grouped.set(result[0].format, result);
      }
    }

    for (const upstreams of grouped.values()) {
      upstreams.sort((left, right) => {
        const leftName = typeof left.name === "string" ? left.name : "";
        const rightName = typeof right.name === "string" ? right.name : "";
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
      });
    }

    return grouped;
  }

  async _fetchFormatUpstreams(cloudsmithAPI, workspace, repoSlug, format) {
    try {
      const result = await cloudsmithAPI.get(`repos/${workspace}/${repoSlug}/upstream/${format}/`);
      if (!Array.isArray(result) || result.length === 0) {
        return [];
      }

      return result.map((upstream) => ({ ...upstream, format }));
    } catch (error) { // eslint-disable-line no-unused-vars
      return [];
    }
  }

  _getLoadingHtml(workspace, repoSlug, repoName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none';">
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    .subtle {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h2>${this._escape(repoName)}</h2>
  <p class="subtle">${this._escape(workspace)}/${this._escape(repoSlug)}</p>
  <p>Loading upstream sources...</p>
</body>
</html>`;
  }

  _getHtmlContent(workspace, repoSlug, repoName, groupedUpstreams) {
    const formatSections = [];

    for (const format of SUPPORTED_FORMATS) {
      const upstreams = groupedUpstreams.get(format);
      if (!upstreams || upstreams.length === 0) {
        continue;
      }

      const cards = upstreams.map((upstream) => this._renderUpstreamCard(upstream)).join("\n");
      formatSections.push(`<section class="format-group">
  <div class="format-header">${this._escape(format)}</div>
  <div class="card-list">
    ${cards}
  </div>
</section>`);
    }

    const contentHtml = formatSections.length > 0
      ? formatSections.join("\n")
      : `<p class="empty-state">No upstream sources configured for this repository.</p>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none';">
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.5;
    }
    h1 {
      margin: 0 0 6px 0;
      font-size: 1.5em;
      font-weight: 600;
    }
    .repo-meta {
      margin: 0 0 24px 0;
      color: var(--vscode-descriptionForeground);
    }
    .format-group + .format-group {
      margin-top: 28px;
    }
    .format-header {
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 1.1em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .card-list {
      display: grid;
      gap: 12px;
    }
    .upstream-card {
      padding: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 1.05em;
      font-weight: 600;
      color: var(--vscode-foreground);
      word-break: break-word;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      font-size: 0.9em;
      white-space: nowrap;
    }
    .status-badge-active {
      color: var(--vscode-testing-iconPassed);
    }
    .status-badge-inactive {
      color: var(--vscode-editorWarning-foreground);
    }
    .details-grid {
      display: grid;
      grid-template-columns: minmax(140px, 180px) minmax(0, 1fr);
      gap: 8px 12px;
    }
    .detail-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
    }
    .detail-value {
      color: var(--vscode-foreground);
      word-break: break-word;
    }
    .mono {
      font-family: var(--vscode-editor-font-family);
    }
    .trust-value-trusted {
      color: var(--vscode-textLink-foreground);
      font-weight: 600;
    }
    .trust-value-untrusted {
      color: var(--vscode-testing-iconPassed);
      font-weight: 600;
    }
    .trust-callout {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      background: var(--vscode-inputValidation-infoBackground);
    }
    .trust-callout-title {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .empty-state {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h1>${this._escape(repoName)}</h1>
  <p class="repo-meta">${this._escape(workspace)}/${this._escape(repoSlug)}</p>
  ${contentHtml}
</body>
</html>`;
  }

  _renderUpstreamCard(upstream) {
    const isActive = upstream.is_active !== false;
    const statusLabel = isActive ? "Active" : "Inactive";
    const statusClass = isActive ? "status-badge-active" : "status-badge-inactive";

    const details = [
      this._renderDetail("URL", upstream.upstream_url, "mono"),
      this._renderDetail("Mode", typeof upstream.mode === "string" ? upstream.mode : "", ""),
      this._renderDetail("SSL Verification", this._getSslVerification(upstream), ""),
      this._renderTrustDetail(upstream),
      this._renderDetail("Validation Status", this._getValidationStatus(upstream), ""),
      this._renderDetail("Distribution", this._getDistribution(upstream), ""),
      this._renderDetail("Created Date", this._formatCreatedAt(upstream.created_at), ""),
    ].filter(Boolean).join("\n");

    const trustCallout = this._renderTrustCallout(upstream);

    return `<article class="upstream-card">
  <div class="card-header">
    <div class="card-title">${this._escape(typeof upstream.name === "string" && upstream.name ? upstream.name : "Unnamed")}</div>
    <span class="status-badge ${statusClass}">${this._escape(statusLabel)}</span>
  </div>
  <div class="details-grid">
    ${details}
  </div>
  ${trustCallout}
</article>`;
  }

  _renderDetail(label, value, valueClass) {
    if (!value) {
      return "";
    }

    const className = valueClass ? `detail-value ${valueClass}` : "detail-value";
    return `<div class="detail-label">${label}</div><div class="${className}">${this._escape(value)}</div>`;
  }

  _renderTrustDetail(upstream) {
    if (upstream.trust_level === "Trusted") {
      return `<div class="detail-label">Trust Level</div><div class="detail-value trust-value-trusted">${this._escape(upstream.trust_level)}</div>`;
    }
    if (upstream.trust_level === "Untrusted") {
      return `<div class="detail-label">Trust Level</div><div class="detail-value trust-value-untrusted">${this._escape(upstream.trust_level)}</div>`;
    }
    return "";
  }

  _renderTrustCallout(upstream) {
    if (upstream.trust_level === "Trusted") {
      return `<div class="trust-callout">
  <span class="trust-callout-title">Trusted upstream:</span>
  ${this._escape("This source can serve any package, including versions of packages that exist in your private repository. Packages from this upstream will not be blocked by dependency confusion protections.")}
</div>`;
    }

    if (upstream.trust_level === "Untrusted") {
      return `<div class="trust-callout">
  <span class="trust-callout-title">Untrusted upstream (recommended):</span>
  ${this._escape("If a package name exists in your private repository or another trusted source, this upstream will be blocked from serving versions of that package. This protects against namesquatting and dependency confusion attacks.")}
</div>`;
    }

    return "";
  }

  _getSslVerification(upstream) {
    if (typeof upstream.verify_ssl !== "boolean") {
      return "";
    }
    return upstream.verify_ssl ? "Enabled" : "Disabled";
  }

  _getValidationStatus(upstream) {
    if (upstream.pending_validation === true) {
      return "Pending Validation";
    }
    if (typeof upstream.verification_status === "string" && upstream.verification_status) {
      return upstream.verification_status;
    }
    if (upstream.pending_validation === false) {
      return "Not Pending";
    }
    return "";
  }

  _getDistribution(upstream) {
    if (typeof upstream.distribution === "string" && upstream.distribution) {
      return upstream.distribution;
    }
    if (Array.isArray(upstream.distro_versions) && upstream.distro_versions.length > 0) {
      return upstream.distro_versions.join(", ");
    }
    if (typeof upstream.upstream_distribution === "string" && upstream.upstream_distribution) {
      return upstream.upstream_distribution;
    }
    return "";
  }

  _escape(value) {
    if (value == null) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _formatCreatedAt(createdAt) {
    if (typeof createdAt !== "string" || !createdAt) {
      return "";
    }

    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }

    return createdAt.slice(0, 10);
  }

  dispose() {
    if (this._panel) {
      this._panel.dispose();
      this._panel = null;
    }
  }
}

module.exports = { UpstreamDetailProvider };
