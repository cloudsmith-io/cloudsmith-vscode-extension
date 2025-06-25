const vscode = require('vscode');
const helpNode = require('../models/helpNode');

class helpProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element) {
        return element.getTreeItem()
    }

    getChildren() {
        const links = [
            { label: 'Read Extension Documentation', url: 'https://cloudsmith.com' },
            { label: 'Get Started with Cloudsmith', url: 'https://help.cloudsmith.io/docs/welcome-to-cloudsmith-docs' },
            { label: 'Review Issues', url: 'https://code.visualstudio.com' },
            { label: 'Report Issue', url: 'https://code.visualstudio.com' }
        ];
        return links.map(link => new helpNode(link.label, link.url));
    }

}

module.exports = { helpProvider };




