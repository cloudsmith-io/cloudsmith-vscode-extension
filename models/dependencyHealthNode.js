// Dependency health node treeview - represents a single dependency from the project manifest
// cross-referenced against Cloudsmith

const vscode = require("vscode");

class DependencyHealthNode {
  /**
   * @param   {{name: string, version: string, devDependency: boolean, format: string}} dep
   *          Parsed dependency from the project manifest.
   * @param   {Object|null} cloudsmithMatch
   *          Matching package from Cloudsmith API, or null if not found.
   * @param   {vscode.ExtensionContext} context
   */
  constructor(dep, cloudsmithMatch, context) {
    this.context = context;
    this.name = dep.name;
    this.declaredVersion = dep.version;
    this.format = dep.format;
    this.isDev = dep.devDependency;
    this.isDirect = dep.isDirect !== false; // default to direct if not specified
    this.cloudsmithMatch = cloudsmithMatch;

    // Derive state from the Cloudsmith match
    this.state = this._deriveState();

    // Store fields from the Cloudsmith match for command compatibility
    if (cloudsmithMatch) {
      this.namespace = cloudsmithMatch.namespace;
      this.repository = cloudsmithMatch.repository;
      this.slug_perm = { id: "Slug Perm", value: cloudsmithMatch.slug_perm };
      this.slug_perm_raw = cloudsmithMatch.slug_perm;
      this.version = { id: "Version", value: cloudsmithMatch.version };
      this.status_str = { id: "Status", value: cloudsmithMatch.status_str };
      this.self_webapp_url = cloudsmithMatch.self_webapp_url || null;
      this.checksum_sha256 = cloudsmithMatch.checksum_sha256 || null;
      this.version_digest = cloudsmithMatch.version_digest || null;
      this.tags_raw = cloudsmithMatch.tags || {};
      this.cdn_url = cloudsmithMatch.cdn_url || null;
      this.filename = cloudsmithMatch.filename || null;
      this.num_vulnerabilities = cloudsmithMatch.num_vulnerabilities || 0;
      this.max_severity = cloudsmithMatch.max_severity || null;
      this.status_reason = cloudsmithMatch.status_reason || null;
    }
  }

  /**
   * Derive the health state from the Cloudsmith match.
   * @returns {"available"|"quarantined"|"violated"|"not_found"|"syncing"}
   */
  _deriveState() {
    if (!this.cloudsmithMatch) {
      return "not_found";
    }

    const match = this.cloudsmithMatch;

    if (match.status_str === "Quarantined") {
      return "quarantined";
    }

    if (match.status_str !== "Completed") {
      return "syncing";
    }

    if (match.deny_policy_violated || match.policy_violated) {
      return "violated";
    }

    return "available";
  }

  _getStateIcon() {
    switch (this.state) {
      case "available":
        return new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
      case "quarantined":
        return new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground"));
      case "violated":
        return new vscode.ThemeIcon("warning", new vscode.ThemeColor("editorWarning.foreground"));
      case "syncing":
        return new vscode.ThemeIcon("sync");
      case "not_found":
      default:
        return new vscode.ThemeIcon("question", new vscode.ThemeColor("descriptionForeground"));
    }
  }

  _getStateDescription() {
    switch (this.state) {
      case "available":
        return "\u2713 Available";
      case "quarantined":
        return "\u26D4 Quarantined";
      case "violated":
        return "\u26A0 Policy violation";
      case "syncing":
        return "\u21BB Syncing";
      case "not_found":
      default:
        return "? Not found in Cloudsmith";
    }
  }

  _buildTooltip() {
    const lines = [`${this.name} ${this.declaredVersion}`];
    lines.push(`Format: ${this.format}`);
    if (this.isDev) {
      lines.push("(dev dependency)");
    }

    lines.push("");

    if (!this.cloudsmithMatch) {
      lines.push("Not found in the configured Cloudsmith workspace.");
      lines.push("This package may need to be uploaded or fetched via upstream proxy.");
    } else {
      const match = this.cloudsmithMatch;
      lines.push(`Cloudsmith version: ${match.version}`);
      lines.push(`Status: ${match.status_str}`);
      if (match.policy_violated) {
        lines.push("Policy violated: yes");
      }
      if (match.deny_policy_violated) {
        lines.push("Deny policy violated: yes");
      }
      if (match.license_policy_violated) {
        lines.push("License policy violated: yes");
      }
      if (match.vulnerability_policy_violated) {
        lines.push("Vulnerability policy violated: yes");
      }
      if (match.num_vulnerabilities > 0) {
        lines.push(`Vulnerabilities: ${match.num_vulnerabilities} (${match.max_severity || "Unknown"})`);
      }
      if (match.license) {
        const { LicenseClassifier } = require("../util/licenseClassifier");
        const classification = LicenseClassifier.classify(match.license);
        const tierLabels = {
          "restrictive": "Restrictive",
          "cautious": "Review required",
          "permissive": "Permissive",
          "unknown": "Unknown",
        };
        lines.push(`License: ${match.license} (${tierLabels[classification.tier] || "Unknown"})`);
      }

      if (this.state === "quarantined" || this.state === "violated") {
        lines.push("");
        lines.push("Right-click \u2192 Explain Quarantine or Find Safe Version");
      }
    }

    return lines.join("\n");
  }

  _getContextValue() {
    switch (this.state) {
      case "quarantined":
        return "dependencyHealthBlocked";
      case "violated":
        return "dependencyHealthViolated";
      case "available":
        return "dependencyHealth";
      case "not_found":
        return "dependencyHealthNotFound";
      case "syncing":
        return "dependencyHealthSyncing";
      default:
        return "dependencyHealth";
    }
  }

  /** Sort key: lower = more urgent (quarantined first). */
  get sortOrder() {
    const order = { quarantined: 0, violated: 1, not_found: 2, syncing: 3, available: 4 };
    return order[this.state] != null ? order[this.state] : 5;
  }

  getTreeItem() {
    const devLabel = this.isDev ? " (dev)" : "";
    const indirectLabel = !this.isDirect ? " (indirect)" : "";
    const versionLabel = this.declaredVersion ? ` ${this.declaredVersion}` : "";

    const desc = this.state === "quarantined"
      ? `${this._getStateDescription()} \u2014 right-click for details`
      : this._getStateDescription();

    return {
      label: `${this.name}${versionLabel}${devLabel}${indirectLabel}`,
      description: desc,
      tooltip: this._buildTooltip(),
      collapsibleState: this.cloudsmithMatch
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      contextValue: this._getContextValue(),
      iconPath: this._getStateIcon(),
    };
  }

  getChildren() {
    if (!this.cloudsmithMatch) {
      return [];
    }

    const PackageDetailsNode = require("./packageDetailsNode");
    const children = [];
    const match = this.cloudsmithMatch;

    // Status
    children.push(new PackageDetailsNode({ id: "Status", value: match.status_str }, this.context));

    // Cloudsmith Version
    children.push(new PackageDetailsNode({ id: "Version", value: match.version }, this.context));

    // License with classification
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    if (config.get("showLicenseIndicators") !== false && match.license) {
      const LicenseNode = require("./licenseNode");
      children.push(new LicenseNode(match.license, match.license_url || null, this.context));
    }

    // Vulnerability summary
    if (match.num_vulnerabilities > 0) {
      const VulnerabilitySummaryNode = require("./vulnerabilitySummaryNode");
      children.push(new VulnerabilitySummaryNode({
        namespace: match.namespace,
        repository: match.repository,
        slug_perm: match.slug_perm,
        num_vulnerabilities: match.num_vulnerabilities,
        max_severity: match.max_severity,
      }, this.context));
    }

    // Policy Violated
    const policyValue = match.policy_violated ? "Yes" : "No";
    children.push(new PackageDetailsNode({ id: "Policy Violated", value: policyValue }, this.context));

    // Quarantine Reason (if quarantined)
    if (match.status_str === "Quarantined" && match.status_reason) {
      const truncated = match.status_reason.length > 80
        ? match.status_reason.substring(0, 80) + "..."
        : match.status_reason;
      const reasonNode = new PackageDetailsNode({
        id: "Quarantine Reason",
        value: truncated,
      }, this.context);
      children.push(reasonNode);
    }

    return children;
  }
}

module.exports = DependencyHealthNode;
