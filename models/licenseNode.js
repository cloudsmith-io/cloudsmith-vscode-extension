// License node treeview - shows license with risk-tier coloring

const vscode = require("vscode");
const { LicenseClassifier } = require("../util/licenseClassifier");

class LicenseNode {
  /**
   * @param   {string|null} license     SPDX license identifier.
   * @param   {string|null} licenseUrl  URL to license text.
   * @param   {vscode.ExtensionContext} context
   */
  constructor(license, licenseUrl, context) {
    this.license = license;
    this.licenseUrl = licenseUrl || null;
    this.context = context;
    this.classification = LicenseClassifier.classify(license);
  }

  _getIcon() {
    const iconMap = {
      "restrictive": new vscode.ThemeIcon("shield", new vscode.ThemeColor("errorForeground")),
      "cautious": new vscode.ThemeIcon("shield", new vscode.ThemeColor("editorWarning.foreground")),
      "permissive": new vscode.ThemeIcon("shield", new vscode.ThemeColor("testing.iconPassed")),
      "unknown": new vscode.ThemeIcon("shield", new vscode.ThemeColor("descriptionForeground")),
    };
    return iconMap[this.classification.tier] || iconMap["unknown"];
  }

  _getDescription() {
    const tierLabel = {
      "restrictive": "\u26D4 Restrictive",
      "cautious": "\u26A0 Review required",
      "permissive": "\u2713 Permissive",
      "unknown": "? Unknown license",
    };
    return tierLabel[this.classification.tier] || tierLabel["unknown"];
  }

  _buildTooltip() {
    const tips = {
      "restrictive": "This license has strong copyleft or viral terms that may require releasing derivative works under the same license. Legal review recommended before use in commercial software.",
      "cautious": "This license has weak copyleft or uncommon terms. Review the specific obligations before use.",
      "permissive": "This license is generally compatible with commercial use with minimal obligations.",
      "unknown": "This license was not recognized. Review the license text manually.",
    };
    const licenseLabel = this.license || "Not specified";
    return `${licenseLabel}\n\n${tips[this.classification.tier] || tips["unknown"]}`;
  }

  getTreeItem() {
    const licenseLabel = this.license || "Not specified";

    const treeItem = {
      label: `License: ${licenseLabel}`,
      description: this._getDescription(),
      tooltip: this._buildTooltip(),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "licenseDetail",
      iconPath: this._getIcon(),
    };

    // If license URL is available, clicking opens it in browser
    if (this.licenseUrl) {
      treeItem.command = {
        command: "cloudsmith-vsc.openLicenseUrl",
        title: "View License",
        arguments: [this],
      };
    }

    return treeItem;
  }

  getChildren() {
    return [];
  }
}

module.exports = LicenseNode;
