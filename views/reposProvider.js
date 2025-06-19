const vscode = require('vscode');
const CloudsmithModel = require('../models/CloudsmithModel');

class RepoProvider {
    constructor(fetchDataFn) {
        this.fetchDataFn = fetchDataFn;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label);
        treeItem.command = {
            command: 'cloudsmith-vscode-extension.selectRepo',
            title: 'Select Item',
            arguments: [element]
        };
        return treeItem;
    }

    async getChildren(element) {
        // Only root level
        if (!element) {
            const data = await this.fetchDataFn();
            return data.map(item => new CloudsmithModel(item.name));
        }

        // No children in this example
        return [];
    }
}

module.exports = { RepoProvider };