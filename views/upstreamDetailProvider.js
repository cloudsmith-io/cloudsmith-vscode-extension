const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { CredentialManager } = require("../util/credentialManager");

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
    this._abortController = null;
    this._requestId = 0;
  }

  async show(workspace, repoSlug, repoName) {
    if (!workspace || !repoSlug || !repoName) {
      vscode.window.showWarningMessage("Could not determine repository details for upstream inspection.");
      return;
    }

    this._abortInFlightRequest();
    const requestId = ++this._requestId;
    const abortController = new AbortController();
    this._abortController = abortController;
    const panel = this._getOrCreatePanel(repoName);

    try {
      if (!this._canRender(panel, requestId)) {
        return;
      }

      panel.title = `Upstreams: ${repoName}`;
      panel.webview.html = this._getLoadingHtml(workspace, repoSlug, repoName);

      const cloudsmithAPI = new CloudsmithAPI(this.context);
      const fetchState = await this._fetchGroupedUpstreams(
        cloudsmithAPI,
        workspace,
        repoSlug,
        abortController.signal
      );

      if (!this._canRender(panel, requestId) || abortController.signal.aborted) {
        return;
      }

      panel.title = `Upstreams: ${repoName}`;
      panel.webview.html = this._getHtmlContent(workspace, repoSlug, repoName, fetchState);
    } finally {
      if (this._abortController === abortController) {
        this._abortController = null;
      }
    }
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
        this._abortInFlightRequest();
      }
    });

    this._panel = panel;
    return panel;
  }

  async _fetchGroupedUpstreams(cloudsmithAPI, workspace, repoSlug, signal) {
    const grouped = new Map();
    const failedFormats = [];
    let successfulFormats = 0;
    let apiKey = null;

    try {
      const credentialManager = new CredentialManager(this.context);
      apiKey = await credentialManager.getApiKey();
    } catch (error) {
      if (this._isAbortError(error) || signal.aborted) {
        return { groupedUpstreams: grouped, failedFormats, successfulFormats };
      }

      return {
        groupedUpstreams: grouped,
        failedFormats: [...SUPPORTED_FORMATS],
        successfulFormats,
      };
    }

    for (let index = 0; index < SUPPORTED_FORMATS.length; index += FETCH_BATCH_SIZE) {
      if (signal.aborted) {
        return { groupedUpstreams: grouped, failedFormats, successfulFormats };
      }

      const batch = SUPPORTED_FORMATS.slice(index, index + FETCH_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((format) => this._fetchFormatUpstreams(
          cloudsmithAPI,
          workspace,
          repoSlug,
          format,
          apiKey,
          signal
        ))
      );

      if (signal.aborted) {
        return { groupedUpstreams: grouped, failedFormats, successfulFormats };
      }

      for (const result of batchResults) {
        if (result.status === "failed") {
          failedFormats.push(result.format);
          continue;
        }

        if (result.status !== "loaded") {
          continue;
        }

        successfulFormats += 1;

        if (result.upstreams.length === 0) {
          continue;
        }

        grouped.set(result.format, result.upstreams);
      }
    }

    for (const upstreams of grouped.values()) {
      upstreams.sort((left, right) => {
        const leftName = typeof left.name === "string" ? left.name : "";
        const rightName = typeof right.name === "string" ? right.name : "";
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
      });
    }

    return { groupedUpstreams: grouped, failedFormats, successfulFormats };
  }

  async _fetchFormatUpstreams(cloudsmithAPI, workspace, repoSlug, format, apiKey, signal) {
    try {
      if (signal.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      const result = await cloudsmithAPI.makeRequest(
        `repos/${workspace}/${repoSlug}/upstream/${format}/`,
        this._getRequestOptions(apiKey, signal)
      );

      if (signal.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      if (typeof result === "string") {
        if (this._isWarningWorthyFormatError(result)) {
          return { format, status: "failed", upstreams: [] };
        }
        return { format, status: "loaded", upstreams: [] };
      }

      if (!Array.isArray(result)) {
        return { format, status: "failed", upstreams: [] };
      }

      if (result.length === 0) {
        return { format, status: "loaded", upstreams: [] };
      }

      return {
        format,
        status: "loaded",
        upstreams: result.map((upstream) => ({ ...upstream, format })),
      };
    } catch (error) {
      if (this._isAbortError(error) || signal.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      if (!this._isWarningWorthyFormatError(error && error.message ? error.message : "")) {
        return { format, status: "loaded", upstreams: [] };
      }

      return { format, status: "failed", upstreams: [] };
    }
  }

  _getRequestOptions(apiKey, signal) {
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
    };

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    return {
      method: "GET",
      headers,
      signal,
    };
  }

  _abortInFlightRequest() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  _canRender(panel, requestId) {
    return this._panel === panel && this._requestId === requestId;
  }

  _isAbortError(error) {
    return error && (error.name === "AbortError" || error.code === "ABORT_ERR");
  }

  _isWarningWorthyFormatError(message) {
    const normalized = typeof message === "string" ? message.toLowerCase() : "";
    if (!normalized) {
      return true;
    }

    const benignKeywords = [
      "response status: 404",
      "not found",
      "unsupported",
      "not applicable",
      "unknown format",
      "no upstream",
      "does not exist",
    ];
    if (benignKeywords.some((keyword) => normalized.includes(keyword))) {
      return false;
    }

    const statusMatch = normalized.match(/response status:\s*(\d{3})/);
    if (statusMatch) {
      const statusCode = Number(statusMatch[1]);
      if (statusCode === 401 || statusCode === 403 || statusCode === 407 || statusCode === 408 || statusCode === 429) {
        return true;
      }
      if (statusCode >= 500) {
        return true;
      }
      if (statusCode >= 400) {
        return true;
      }
    }

    const warningKeywords = [
      "blocked ",
      "redirect",
      "fetch failed",
      "network",
      "timed out",
      "timeout",
      "unauthorized",
      "forbidden",
      "permission",
      "access denied",
      "server error",
      "bad gateway",
      "service unavailable",
      "gateway timeout",
      "econn",
      "enotfound",
      "eai_again",
      "socket",
      "tls",
      "certificate",
    ];

    if (warningKeywords.some((keyword) => normalized.includes(keyword))) {
      return true;
    }

    return true;
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
      padding: 16px 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h2 {
      margin: 0 0 4px 0;
      font-size: 1.35em;
      font-weight: 600;
      line-height: 1.3;
    }
    p {
      margin: 0;
      line-height: 1.4;
    }
    .subtle {
      margin-bottom: 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.95em;
    }
    .loading-copy {
      color: var(--vscode-foreground);
    }
  </style>
</head>
<body>
  <h2>${this._escape(repoName)}</h2>
  <p class="subtle">${this._escape(workspace)}/${this._escape(repoSlug)}</p>
  <p class="loading-copy">Loading upstreams...</p>
</body>
</html>`;
  }

  _getHtmlContent(workspace, repoSlug, repoName, fetchState) {
    const { groupedUpstreams, failedFormats, successfulFormats } = fetchState;
    const formatSections = [];
    const hasFailures = failedFormats.length > 0;
    const hasLoadedUpstreams = groupedUpstreams.size > 0;

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

    const contentHtml = hasLoadedUpstreams
      ? formatSections.join("\n")
      : this._getEmptyOrErrorState(hasFailures, successfulFormats);
    const warningHtml = hasFailures && hasLoadedUpstreams
      ? `<div class="warning-banner">Some upstream data could not be loaded.</div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none';">
  <style>
    body {
      margin: 0;
      padding: 16px 24px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 1.35em;
      font-weight: 600;
      line-height: 1.3;
    }
    .repo-meta {
      margin: 0 0 16px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 0.95em;
      line-height: 1.35;
    }
    .warning-banner {
      margin: 0 0 12px 0;
      padding: 8px 10px;
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 6px;
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-foreground);
      line-height: 1.4;
    }
    .error-state {
      margin-top: 8px;
      padding: 12px 14px;
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 6px;
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-foreground);
      line-height: 1.4;
    }
    .error-state-title {
      display: block;
      margin-bottom: 3px;
      font-weight: 600;
      color: var(--vscode-errorForeground);
    }
    .format-group + .format-group {
      margin-top: 20px;
    }
    .format-header {
      margin: 0 0 8px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 1em;
      font-weight: 600;
      color: var(--vscode-foreground);
      line-height: 1.3;
    }
    .card-list {
      display: grid;
      gap: 8px;
    }
    .upstream-card {
      padding: 12px 14px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: var(--vscode-editor-background);
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .card-title {
      font-size: 1em;
      font-weight: 600;
      color: var(--vscode-foreground);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      font-size: 0.85em;
      line-height: 1.3;
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
      grid-template-columns: minmax(118px, 136px) minmax(0, 1fr);
      gap: 5px 10px;
      align-items: start;
    }
    .detail-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      font-size: 0.9em;
      line-height: 1.35;
    }
    .detail-value {
      color: var(--vscode-foreground);
      line-height: 1.35;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    .mono {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.95em;
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
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      background: var(--vscode-inputValidation-infoBackground);
      line-height: 1.4;
    }
    .trust-callout-title {
      display: block;
      margin-bottom: 2px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .empty-state {
      margin: 8px 0 0 0;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h1>${this._escape(repoName)}</h1>
  <p class="repo-meta">${this._escape(workspace)}/${this._escape(repoSlug)}</p>
  ${warningHtml}
  ${contentHtml}
</body>
</html>`;
  }

  _getEmptyOrErrorState(hasFailures, successfulFormats) {
    if (!hasFailures) {
      return `<p class="empty-state">No upstreams configured for this repository.</p>`;
    }

    const detail = successfulFormats > 0
      ? "Some upstream formats could not be loaded, so the upstream configuration could not be determined."
      : "The upstream configuration could not be loaded for this repository.";

    return `<div class="error-state">
  <span class="error-state-title">Could not load upstreams.</span>
  ${this._escape(detail)}
</div>`;
  }

  _renderUpstreamCard(upstream) {
    const isActive = upstream.is_active !== false;
    const statusLabel = isActive ? "Active" : "Inactive";
    const statusClass = isActive ? "status-badge-active" : "status-badge-inactive";

    const details = [
      this._renderDetail("URL", upstream.upstream_url, "mono"),
      this._renderDetail("Mode", typeof upstream.mode === "string" ? upstream.mode : "", ""),
      this._renderDetail("Priority", this._getPriority(upstream), ""),
      this._renderDetail("SSL verification", this._getSslVerification(upstream), ""),
      this._renderTrustDetail(upstream),
      this._renderDetail("Indexing", this._getIndexingDisplay(upstream), ""),
      this._renderDetail("Distribution", this._getDistribution(upstream), ""),
      this._renderDetail("Created", this._formatCreatedAt(upstream.created_at), ""),
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
      return `<div class="detail-label">Trust level</div><div class="detail-value trust-value-trusted">${this._escape(upstream.trust_level)}</div>`;
    }
    if (upstream.trust_level === "Untrusted") {
      return `<div class="detail-label">Trust level</div><div class="detail-value trust-value-untrusted">${this._escape(upstream.trust_level)}</div>`;
    }
    return "";
  }

  _renderTrustCallout(upstream) {
    if (upstream.trust_level === "Trusted") {
      return `<div class="trust-callout">
  <span class="trust-callout-title">Trusted upstream:</span>
  ${this._escape("This source can serve any package, including versions of packages that exist in a private repository. Packages from this upstream are not blocked by dependency confusion protections.")}
</div>`;
    }

    if (upstream.trust_level === "Untrusted") {
      return `<div class="trust-callout">
  <span class="trust-callout-title">Untrusted upstream (recommended):</span>
  ${this._escape("If a package name exists in a private repository or another trusted source, this upstream is blocked from serving versions of that package. This protects against namesquatting and dependency confusion attacks.")}
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

  _getIndexingDisplay(upstream) {
    const indexStatus = typeof upstream.index_status === "string" ? upstream.index_status : "";
    const packageCount = this._formatIndexPackageCount(upstream.index_package_count);

    if (!indexStatus && !packageCount) {
      return "";
    }

    const indicator = this._getIndexingIndicator(indexStatus);
    const statusText = indicator ? `${indicator} ${indexStatus}` : indexStatus;

    if (!statusText) {
      return packageCount;
    }

    if (!packageCount) {
      return statusText;
    }

    return `${statusText} - ${packageCount}`;
  }

  _getIndexingIndicator(indexStatus) {
    const normalized = typeof indexStatus === "string" ? indexStatus.toLowerCase() : "";
    if (normalized.includes("in progress")) {
      return "↻";
    }
    if (normalized.includes("up-to-date")) {
      return "✓";
    }
    return "";
  }

  _formatIndexPackageCount(indexPackageCount) {
    if (typeof indexPackageCount === "number" && Number.isFinite(indexPackageCount)) {
      const label = indexPackageCount === 1 ? "package" : "packages";
      return `${indexPackageCount.toLocaleString()} ${label}`;
    }
    if (typeof indexPackageCount === "string" && indexPackageCount.trim()) {
      const numericValue = Number(indexPackageCount);
      if (Number.isFinite(numericValue)) {
        const label = numericValue === 1 ? "package" : "packages";
        return `${numericValue.toLocaleString()} ${label}`;
      }
    }
    return "";
  }

  _getPriority(upstream) {
    if (typeof upstream.priority === "number" && Number.isFinite(upstream.priority)) {
      return String(upstream.priority);
    }
    if (typeof upstream.priority === "string" && upstream.priority.trim()) {
      return upstream.priority;
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
    this._abortInFlightRequest();

    if (this._panel) {
      this._panel.dispose();
      this._panel = null;
    }
  }
}

module.exports = { UpstreamDetailProvider };
