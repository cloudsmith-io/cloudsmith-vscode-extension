const vscode = require('vscode');
const path = require('path');
const WorkspaceModel = require('../models/workspaceNode');

class WorkspaceProvider {
    constructor(fetchDataFn) {
        this.fetchDataFn = fetchDataFn;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        //console.log(element);
        const treeItem = new vscode.TreeItem(element);
        let iconPath = path.join(__filename, "..", "..", "media", "CloudsmithSymbol--WhiteTransparent@M.svg");
        treeItem.command = {
            command: 'cloudsmith-vscode-extension.selectWorkspace',
            title: 'Select Item',
            arguments: [element]
        };
        treeItem.tooltip = 'Slug: '+  element.slug;
        treeItem.iconPath = iconPath;
        return treeItem;
    }

    async getChildren(element) {
        if (!element) {
            const data = await this.fetchDataFn();
            return data.map(item => new WorkspaceModel(item.name, item))
;
        }
        return [];
    }
}

module.exports = { WorkspaceProvider };