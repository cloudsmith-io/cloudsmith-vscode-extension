const vscode = require('vscode');
const path = require('path');
const cloudsmithApi = require('../util/cloudsmithAPI');
const env = require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load from .env
const apiKey = env.parsed.CLOUDSMITH_API_KEY;

class CloudsmithProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element) {
        return element.getTreeItem()
    }

    getChildren(element) {
        if (!element) {
            return this.getWorkspaces()
        }
        return element.getChildren()
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async getWorkspaces() {
        const workspaces = await cloudsmithApi.get('namespaces' + '/?sort=slug', apiKey);
        console.log(workspaces)
        const WorkspaceNodes = []
        if(workspaces) {
            for(const id of workspaces) {
                const workspaceNode = require('../models/workspaceNode')
                const workspaceNodeInst = new workspaceNode(id)
                WorkspaceNodes.push(workspaceNodeInst)
            }
        }
        return WorkspaceNodes
        
    }

}

module.exports = { CloudsmithProvider };