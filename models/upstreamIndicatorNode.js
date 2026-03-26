// Upstream indicator node treeview.
// Appears at the top of a repository's package list when upstream sources are configured.

const vscode = require("vscode");

class UpstreamIndicatorNode {
    constructor(upstreams, context) {
        this.context = context;
        this.upstreams = upstreams;
    }

    getTreeItem() {
        const count = this.upstreams.length;
        const active = this.upstreams.filter(u => u.is_active !== false).length;

        return {
            label: `Upstreams: ${active} active of ${count} configured`,
            tooltip: this.upstreams.map(u => `${u.name} (${u.upstream_url})`).join('\n'),
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: "upstreamIndicator",
            iconPath: new vscode.ThemeIcon('cloud'),
        };
    }

    getChildren() {
        return [];
    }
}

module.exports = UpstreamIndicatorNode;
