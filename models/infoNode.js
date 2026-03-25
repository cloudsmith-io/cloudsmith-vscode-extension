// Generic informational placeholder node for tree views.
// Used for welcome states, empty results, and status messages.

const vscode = require("vscode");

class InfoNode {
  /**
   * @param {string} label       Primary text.
   * @param {string} description Secondary text shown after the label.
   * @param {string} tooltip     Hover text.
   * @param {string} icon        ThemeIcon id (e.g., "folder", "warning", "info").
   * @param {string} contextValue Optional contextValue for menu targeting.
   */
  constructor(label, description, tooltip, icon, contextValue, command) {
    this._label = label;
    this._description = description || "";
    this._tooltip = tooltip || label;
    this._icon = icon || "info";
    this._contextValue = contextValue || "infoNode";
    this._command = command || null;
  }

  getTreeItem() {
    const item = {
      label: this._label,
      description: this._description,
      tooltip: this._tooltip,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: this._contextValue,
      iconPath: new vscode.ThemeIcon(this._icon),
    };
    if (this._command) {
      item.command = this._command;
    }
    return item;
  }

  getChildren() {
    return [];
  }
}

module.exports = InfoNode;
