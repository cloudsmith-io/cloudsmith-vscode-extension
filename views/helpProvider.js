//  This class handles the help & feedback view

const vscode = require('vscode');
const helpNode = require('../models/helpNode');
const path = require('path');

class helpProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element) {
        return element.getTreeItem();
    }

    getChildren(element) {
        if (element && typeof element.getChildren === "function") {
            return element.getChildren();
        }

        const cloudsmithLogo = {
            light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
            dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg")
        };

        const links = [
            { label: 'Read extension documentation', url: 'https://docs.cloudsmith.com/developer-tools/vscode', icon: new vscode.ThemeIcon('link-external') },
            { label: 'Get started with Cloudsmith', url: 'https://docs.cloudsmith.com/', icon: cloudsmithLogo },
            { label: 'View issues', url: 'https://github.com/cloudsmith-io/cloudsmith-vscode-extension/issues', icon: new vscode.ThemeIcon('logo-github') },
            { label: 'Report an issue', url: 'https://github.com/cloudsmith-io/cloudsmith-vscode-extension/issues', icon: new vscode.ThemeIcon('logo-github') }
        ];
        return links.map(link => new helpNode(link.label, link.url, link.icon));
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

module.exports = { helpProvider };


