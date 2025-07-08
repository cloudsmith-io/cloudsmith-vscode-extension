const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { ConnectionManager } = require("../util/connectionManager");

class CloudsmithProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  getTreeItem(element) {
    return element.getTreeItem();
  }

  getChildren(element) {
    if (!element) {
      return this.getWorkspaces();
    }
    return element.getChildren();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getWorkspaces() {
    const context = this.context;
    const cloudsmithAPI = new CloudsmithAPI(context);
    const connectionManager = new ConnectionManager(context);
    let workspaces = "";

    const connStatus = await connectionManager.connect(context);

    if (!connStatus) {
      workspaces = "";
    } else {
      workspaces = await cloudsmithAPI.get("namespaces/?sort=slug");
    }

    const WorkspaceNodes = []
    if (workspaces) {
      for (const workspace of workspaces) {
        const workspaceNode = require("../models/workspaceNode");
        const workspaceNodeInst = new workspaceNode(workspace, context);
        WorkspaceNodes.push(workspaceNodeInst);
      }
      context.globalState.update('CloudsmithCache', {
        name: 'Workspaces',
        lastSync: Date.now(),
        workspaces: workspaces
      });
    }
    
    return WorkspaceNodes;
  }
}

module.exports = { CloudsmithProvider };
