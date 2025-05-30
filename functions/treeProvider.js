const vscode = require('vscode');

export class MyTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState = vscode.TreeItemCollapsibleState.None, contextValue = 'item') {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.tooltip = `Details about ${label}`;
        this.description = label;
    }
}

export class TreeDataProvider {
    constructor(fetchDataFn) {
        this.fetchDataFn = fetchDataFn;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        // Only root level
        if (!element) {
            const data = await this.fetchDataFn();
            return data.map(item => new MyTreeItem(item.name));
        }

        // No children in this example
        return [];
    }
}