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
        return element.getTreeItem()
    }

    getChildren() {

        const cloudsmithLogo = {
                light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
                dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg")
            }

        const links = [
            { label: 'Read Extension Documentation', url: 'https://github.com/cloudsmith-io/cloudsmith-vscode-extension/blob/main/README.md', icon: new vscode.ThemeIcon('link-external') },
            { label: 'Get Started with Cloudsmith', url: 'https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs', icon: cloudsmithLogo },
            { label: 'Review Issues', url: 'https://github.com/cloudsmith-io/cloudsmith-vscode-extension/issues', icon: new vscode.ThemeIcon('logo-github') },
            { label: 'Report Issue', url: 'https://github.com/cloudsmith-io/cloudsmith-vscode-extension/issues', icon: new vscode.ThemeIcon('logo-github') }
        ];
        return links.map(link => new helpNode(link.label, link.url, link.icon));
    }
}

module.exports = { helpProvider };




