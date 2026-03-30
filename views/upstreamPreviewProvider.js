// Upstream resolution preview WebView panel.
// Shows a "what if I pull this?" dry run for packages that don't exist locally.

const vscode = require("vscode");

class UpstreamPreviewProvider {
  constructor(context) {
    this.context = context;
    this._panel = null;
  }

  /**
   * Show the upstream preview panel for a resolution result.
   * @param {Object} result - Output from UpstreamChecker.previewResolution()
   */
  show(result) {
    if (this._panel) {
      this._panel.dispose();
    }

    this._panel = vscode.window.createWebviewPanel(
      "cloudsmithUpstreamPreview",
      `Upstream preview: ${result.name}`,
      vscode.ViewColumn.One,
      { enableScripts: false, localResourceRoots: [] }
    );

    this._panel.webview.html = this._getHtmlContent(result);

    this._panel.onDidDispose(() => {
      this._panel = null;
    });
  }

  _getHtmlContent(result) {
    const localStatus = result.local.error
      ? `<span class="status-error">Could not load local package data: ${this._escapeHtml(result.local.error)}</span>`
      : result.local.data
        ? `<span class="status-found">Found in ${this._escapeHtml(result.repo)} (${this._escapeHtml(result.local.data.status_str || "Unknown")})</span>`
        : `<span class="status-missing">Not found in ${this._escapeHtml(result.repo)}</span>`;

    let upstreamHtml = "";
    if (result.upstreams.error) {
      upstreamHtml = `<p class="error-banner">Could not load upstream data: ${this._escapeHtml(result.upstreams.error)}</p>`;
    } else if (result.upstreams.data.configs.length === 0) {
      upstreamHtml = '<p class="muted">No upstreams configured for this format.</p>';
    } else {
      upstreamHtml = '<table class="data-table"><thead><tr><th>Name</th><th>URL</th><th>Status</th></tr></thead><tbody>';
      for (const u of result.upstreams.data.configs) {
        const active = u.is_active !== false;
        const statusClass = active ? "status-active" : "status-inactive";
        const statusLabel = active ? "Active" : "Inactive";
        upstreamHtml += `<tr>
          <td>${this._escapeHtml(u.name || "Unnamed")}</td>
          <td class="mono">${this._escapeHtml(u.upstream_url || "")}</td>
          <td class="${statusClass}">${statusLabel}</td>
        </tr>`;
      }
      upstreamHtml += "</tbody></table>";
    }

    let policyHtml = "";
    if (result.policies.error) {
      policyHtml = `<p class="error-banner">Could not load policy simulation: ${this._escapeHtml(result.policies.error)}</p>`;
    } else {
      const pols = Array.isArray(result.policies.data) ? result.policies.data : (result.policies.data && result.policies.data.results) || [];
      if (pols.length === 0) {
        policyHtml = '<p class="muted">No active policies found.</p>';
      } else {
        policyHtml = '<table class="data-table"><thead><tr><th>Policy</th><th>Type</th><th>Action</th></tr></thead><tbody>';
        for (const p of pols) {
          policyHtml += `<tr>
            <td>${this._escapeHtml(p.name || p.slug_perm || "Unknown")}</td>
            <td>${this._escapeHtml(p.policy_type || p.type || "")}</td>
            <td>${this._escapeHtml(p.on_violation_quarantine ? "Quarantine" : (p.action || "Tag or warn"))}</td>
          </tr>`;
        }
        policyHtml += "</tbody></table>";
      }
    }

    const resolutionSummary = result.canResolveViaUpstream
      ? `<div class="resolution-yes">This package can likely resolve through ${result.upstreams.data.active} active upstream${result.upstreams.data.active === 1 ? "" : "s"}. ` +
        "If Block Until Scan is enabled, the package stays blocked until policy evaluation completes.</div>"
      : '<div class="resolution-no">No active upstreams for this format. Upload the package directly.</div>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; base-uri 'none'; form-action 'none';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
  h2 { color: var(--vscode-foreground); margin-top: 0; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
  h3 { color: var(--vscode-foreground); margin-top: 20px; }
  .header-info { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin-bottom: 16px; }
  .header-info dt { font-weight: 600; color: var(--vscode-descriptionForeground); }
  .header-info dd { margin: 0; }
  .data-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .data-table th, .data-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); }
  .data-table th { color: var(--vscode-descriptionForeground); font-weight: 600; font-size: 0.9em; }
  .mono { font-family: var(--vscode-editor-font-family); font-size: 0.9em; }
  .status-found { color: var(--vscode-testing-iconPassed); }
  .status-missing { color: var(--vscode-errorForeground); }
  .status-active { color: var(--vscode-testing-iconPassed); }
  .status-inactive { color: var(--vscode-descriptionForeground); }
  .status-error { color: var(--vscode-errorForeground); font-weight: 600; }
  .muted { color: var(--vscode-descriptionForeground); font-style: italic; }
  .error-banner { background: var(--vscode-inputValidation-errorBackground, rgba(255,0,0,0.08)); border: 1px solid var(--vscode-inputValidation-errorBorder, #c42b1c); color: var(--vscode-errorForeground); padding: 10px 12px; border-radius: 4px; }
  .resolution-yes { background: var(--vscode-inputValidation-infoBackground); border: 1px solid var(--vscode-inputValidation-infoBorder); padding: 10px; border-radius: 4px; margin: 12px 0; }
  .resolution-no { background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); padding: 10px; border-radius: 4px; margin: 12px 0; }
</style>
</head>
<body>
  <h2>Upstream resolution preview</h2>
  <dl class="header-info">
    <dt>Package</dt><dd>${this._escapeHtml(result.name)}</dd>
    <dt>Format</dt><dd>${this._escapeHtml(result.format)}</dd>
    <dt>Target repository</dt><dd>${this._escapeHtml(result.workspace)}/${this._escapeHtml(result.repo)}</dd>
    <dt>Local status</dt><dd>${localStatus}</dd>
  </dl>

  ${resolutionSummary}

  <h3>Upstreams (${result.upstreams.data.active} active of ${result.upstreams.data.total})</h3>
  ${upstreamHtml}

  <h3>Active policies</h3>
  ${policyHtml}
</body>
</html>`;
  }

  _escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  dispose() {
    if (this._panel) {
      this._panel.dispose();
      this._panel = null;
    }
  }
}

module.exports = { UpstreamPreviewProvider };
