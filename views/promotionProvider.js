// Cross-repository promotion provider.
// Shows a package's lifecycle across repos (dev -> staging -> production)
// and enables one-click promotion with automatic tagging.

const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");

class PromotionProvider {
  constructor(context) {
    this.context = context;
    this.api = new CloudsmithAPI(context);
  }

  _normalizeFieldValue(value) {
    if (value == null) {
      return null;
    }
    return String(value);
  }

  _escapeQueryValue(value) {
    if (value == null) {
      return "";
    }

    return String(value)
      .replace(/(\\|&&|\|\||[+\-!(){}\[\]^"~*?:/|&])/g, (match) => `\\${match}`)
      .replace(/[\u0000-\u001f\u007f]/g, " ");
  }

  _buildExactPackageQuery(name, version, format) {
    return `name:"${this._escapeQueryValue(name)}" AND version:"${this._escapeQueryValue(version)}" AND format:"${this._escapeQueryValue(format)}"`;
  }

  _packageMatchesExpected(pkg, expected) {
    if (!pkg || typeof pkg !== "object" || !expected) {
      return false;
    }

    return this._normalizeFieldValue(pkg.name) === this._normalizeFieldValue(expected.name)
      && this._normalizeFieldValue(pkg.version) === this._normalizeFieldValue(expected.version)
      && this._normalizeFieldValue(pkg.format) === this._normalizeFieldValue(expected.format);
  }

  _getPackageIdentifier(pkg) {
    if (!pkg || typeof pkg !== "object") {
      return null;
    }
    if (typeof pkg.slug_perm === "string") {
      return pkg.slug_perm;
    }
    if (pkg.slug_perm && typeof pkg.slug_perm === "object" && pkg.slug_perm.value) {
      return String(pkg.slug_perm.value);
    }
    if (typeof pkg.slug_perm_raw === "string") {
      return pkg.slug_perm_raw;
    }
    return null;
  }

  _normalizePackage(pkg) {
    if (!pkg || typeof pkg !== "object") {
      return null;
    }

    return {
      name: pkg.name || null,
      version: pkg.version || null,
      format: pkg.format || null,
      repository: pkg.repository || null,
      slug_perm: this._getPackageIdentifier(pkg),
    };
  }

  _replacePlaceholders(template, sourceRepo, targetRepo, dateStr) {
    return template
      .replace(/\{target\}/g, targetRepo)
      .replace(/\{source\}/g, sourceRepo)
      .replace(/\{date\}/g, dateStr);
  }

  async _tagPackage(workspace, repo, identifier, tags, apiKey, label) {
    if (!identifier) {
      console.warn(`[Promotion] Skipping ${label} tags because package identifier was not available.`);
      return false;
    }

    const tagPayload = JSON.stringify({ action: "add", tags });
    const tagResult = await this.api.post(
      `packages/${workspace}/${repo}/${identifier}/tag/`,
      tagPayload,
      apiKey
    );

    if (typeof tagResult === "string") {
      console.warn(`[Promotion] Failed to apply ${label} tags for ${workspace}/${repo}/${identifier}: ${tagResult}`);
      return false;
    }

    return true;
  }

  async _locateCopiedPackage(workspace, targetRepo, packageInfo, apiKey) {
    if (!packageInfo || !packageInfo.name || !packageInfo.version || !packageInfo.format) {
      return null;
    }

    const query = encodeURIComponent(
      this._buildExactPackageQuery(packageInfo.name, packageInfo.version, packageInfo.format)
    );
    const results = await this.api.get(
      `packages/${workspace}/${targetRepo}/?query=${query}&page_size=100`,
      apiKey
    );

    if (typeof results === "string") {
      console.warn(`[Promotion] Could not locate copied package in ${workspace}/${targetRepo}: ${results}`);
      return null;
    }

    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`[Promotion] Could not locate copied package in ${workspace}/${targetRepo}: no matching package found.`);
      return null;
    }

    const exactResults = results.filter(pkg => this._packageMatchesExpected(pkg, packageInfo));
    if (exactResults.length === 0) {
      console.warn(
        `[Promotion] Could not locate copied package in ${workspace}/${targetRepo}: query returned packages but none matched ${packageInfo.name}@${packageInfo.version} (${packageInfo.format}).`
      );
      return null;
    }

    if (packageInfo.slug_perm) {
      const exactMatch = exactResults.find(pkg => this._getPackageIdentifier(pkg) === packageInfo.slug_perm);
      if (exactMatch) {
        return exactMatch;
      }
    }

    return exactResults.find(pkg => pkg.repository === targetRepo) || exactResults[0] || null;
  }

  /**
   * Get the configured promotion pipeline from settings.
   * Validates repo slugs against cached data and warns about invalid entries.
   * @returns {string[]} Ordered list of repository slugs.
   */
  getPipeline() {
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const pipeline = config.get("promotionPipeline") || [];
    if (pipeline.length > 0 && !this._pipelineValidated) {
      this._pipelineValidated = true;
      this._validatePipeline(pipeline);
    }
    return pipeline;
  }

  /**
   * Validate pipeline repo slugs against cached workspace data.
   * Shows a warning for any invalid entries.
   */
  async _validatePipeline(pipeline) {
    const defaultWs = vscode.workspace.getConfiguration("cloudsmith-vsc").get("defaultWorkspace");
    if (!defaultWs) {
      return;
    }
    const repos = await this.api.get(`repos/${defaultWs}/?sort=name`);
    if (typeof repos === "string" || !Array.isArray(repos)) {
      return;
    }
    const validSlugs = new Set(repos.map(r => r.slug));
    const invalidSlugs = pipeline.filter(s => !validSlugs.has(s));
    if (invalidSlugs.length > 0) {
      vscode.window.showWarningMessage(
        `Promotion pipeline contains unknown repositories: ${invalidSlugs.join(", ")}. Check the cloudsmith-vsc.promotionPipeline setting.`
      );
    }
  }

  /**
   * Get the configured tag templates from settings.
   * @returns {Object} Tag templates with onPromote and onReceive arrays.
   */
  getTagTemplates() {
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    return config.get("promotionTags") || {
      onPromote: ["promoted-to-{target}", "approved-{date}"],
      onReceive: ["promoted-from-{source}"],
    };
  }

  /**
   * Get promotion status for a package across all pipeline repos.
   *
   * @param   {string} workspace  Workspace slug.
   * @param   {string} name       Package name.
   * @param   {string} version    Package version.
   * @param   {string} format     Package format.
   * @returns {Array}             Array of { repo, found, status, pkg } for each pipeline repo.
   */
  async getPromotionStatus(workspace, name, version, format) {
    const pipeline = this.getPipeline();
    if (pipeline.length === 0) {
      return [];
    }
    if (!name || !version || !format) {
      return [];
    }

    // Search workspace-wide for this package name+version
    const query = encodeURIComponent(
      this._buildExactPackageQuery(name, version, format)
    );
    const results = await this.api.get(
      `packages/${workspace}/?query=${query}&page_size=100`
    );

    // Build a map of repo slug -> package data
    const repoMap = {};
    if (Array.isArray(results)) {
      const exactResults = results.filter(pkg =>
        this._packageMatchesExpected(pkg, { name, version, format })
      );
      for (const pkg of exactResults) {
        repoMap[pkg.repository] = pkg;
      }
    }

    // Map pipeline repos to their status
    return pipeline.map(repo => {
      const pkg = repoMap[repo] || null;
      return {
        repo,
        found: !!pkg,
        status: pkg ? (pkg.status_str || "Unknown") : "Not present",
        quarantined: pkg ? (pkg.status_str === "Quarantined") : false,
        policyViolated: pkg ? (pkg.policy_violated || false) : false,
        pkg,
      };
    });
  }

  /**
   * Promote a package from one repo to another with tagging.
   *
   * @param   {string} workspace   Workspace slug.
   * @param   {string} sourceRepo  Source repository slug.
   * @param   {string} slugPerm    Package slug_perm identifier.
   * @param   {string} targetRepo  Target repository slug.
   * @returns {boolean}            True if promotion succeeded.
   */
  async promote(workspace, sourceRepo, slugPerm, targetRepo) {
    const credentialManager = require("../util/credentialManager");
    const cm = new credentialManager.CredentialManager(this.context);
    const apiKey = await cm.getApiKey();
    const templates = this.getTagTemplates();
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const sourcePackageResult = await this.api.get(
      `packages/${workspace}/${sourceRepo}/${slugPerm}/`,
      apiKey
    );
    const sourcePackage = this._normalizePackage(
      typeof sourcePackageResult === "string" ? null : sourcePackageResult
    );

    // Step 1: Copy the package to the target repo
    const copyEndpoint = `packages/${workspace}/${sourceRepo}/${slugPerm}/copy/`;
    const copyPayload = JSON.stringify({
      destination: `${workspace}/${targetRepo}`,
    });

    const copyResult = await this.api.post(copyEndpoint, copyPayload, apiKey);

    if (typeof copyResult === "string") {
      console.warn(`[Promotion] Copy failed: ${copyResult}`);
      return { success: false, error: copyResult };
    }

    if (templates.onPromote && templates.onPromote.length > 0) {
      const tags = templates.onPromote.map(tmpl =>
        this._replacePlaceholders(tmpl, sourceRepo, targetRepo, dateStr)
      );
      await this._tagPackage(workspace, sourceRepo, slugPerm, tags, apiKey, "onPromote");
    }

    if (templates.onReceive && templates.onReceive.length > 0) {
      const copiedPackage = this._normalizePackage(copyResult) || sourcePackage;
      const locatedPackage = await this._locateCopiedPackage(
        workspace,
        targetRepo,
        copiedPackage,
        apiKey
      );

      if (locatedPackage) {
        const tags = templates.onReceive.map(tmpl =>
          this._replacePlaceholders(tmpl, sourceRepo, targetRepo, dateStr)
        );
        const identifier = this._getPackageIdentifier(locatedPackage);
        await this._tagPackage(workspace, targetRepo, identifier, tags, apiKey, "onReceive");
      } else {
        console.warn(
          `[Promotion] Skipping onReceive tags for ${workspace}/${targetRepo} because the copied package could not be located.`
        );
      }
    }

    return { success: true, error: null };
  }
}

module.exports = { PromotionProvider };
