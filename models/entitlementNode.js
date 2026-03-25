// Entitlement token tree node.
// Shows entitlement token info under a repository for debugging access issues.

const vscode = require("vscode");

/**
 * Summary header node: "Entitlements: {active} active of {total}"
 */
class EntitlementSummaryNode {
  constructor(entitlements, context) {
    this.context = context;
    this.entitlements = entitlements || [];
    this.activeCount = this.entitlements.filter(e => e.is_active !== false).length;
  }

  getTreeItem() {
    return {
      label: `Entitlements: ${this.activeCount} active of ${this.entitlements.length}`,
      tooltip: `${this.entitlements.length} entitlement token(s) configured`,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "entitlementSummary",
      iconPath: new vscode.ThemeIcon("key"),
    };
  }

  getChildren() {
    return this.entitlements.map(e => new EntitlementNode(e, this.context));
  }
}

/**
 * Individual entitlement token node.
 */
class EntitlementNode {
  constructor(entitlement, context) {
    this.context = context;
    this.entitlement = entitlement;
    this.tokenName = entitlement.name || "Unnamed Token";
    this.isActive = entitlement.is_active !== false;
    this.token = entitlement.token || null;
    this.scope = entitlement.package_query || null;
    this.slugPerm = entitlement.slug_perm || null;

    // Limits
    this.limitBandwidth = entitlement.limit_bandwidth || null;
    this.limitBandwidthUnit = entitlement.limit_bandwidth_unit || null;
    this.limitDownloads = entitlement.limit_num_downloads || null;
    this.limitClients = entitlement.limit_num_clients || null;
    this.limitDateRangeFrom = entitlement.limit_date_range_from || null;
    this.limitDateRangeTo = entitlement.limit_date_range_to || null;
  }

  getTreeItem() {
    const statusLabel = this.isActive ? "Active" : "Disabled";
    const descParts = [statusLabel];
    if (this.scope) {
      descParts.push(`scope: ${this.scope}`);
    }

    const iconColor = this.isActive
      ? new vscode.ThemeColor("testing.iconPassed")
      : new vscode.ThemeColor("descriptionForeground");

    return {
      label: this.tokenName,
      description: descParts.join(" \u2014 "),
      tooltip: this._buildTooltip(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "entitlement",
      iconPath: new vscode.ThemeIcon("key", iconColor),
    };
  }

  _buildTooltip() {
    const parts = [`Name: ${this.tokenName}`, `Status: ${this.isActive ? "Active" : "Disabled"}`];
    if (this.scope) {
      parts.push(`Package Scope: ${this.scope}`);
    }
    if (this.limitBandwidth) {
      parts.push(`Bandwidth Limit: ${this.limitBandwidth} ${this.limitBandwidthUnit || ""}`);
    }
    if (this.limitDownloads) {
      parts.push(`Download Limit: ${this.limitDownloads}`);
    }
    if (this.limitClients) {
      parts.push(`Client Limit: ${this.limitClients}`);
    }
    if (this.limitDateRangeFrom || this.limitDateRangeTo) {
      parts.push(`Valid: ${this.limitDateRangeFrom || "—"} to ${this.limitDateRangeTo || "—"}`);
    }
    return parts.join("\n");
  }

  getChildren() {
    return [];
  }
}

module.exports = { EntitlementSummaryNode };
