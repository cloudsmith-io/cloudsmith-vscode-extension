const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const connectionManager = require("../util/connectionManager");

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
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    let workspaces = "";

    const connStatus = await connectionManager.connect(this.context);
    //const apiKey = await connectionManager.getApiKey(this.context);
    //console.log(apiKey);

    if (!connStatus) {
      workspaces = "";
    } else {
      workspaces = await cloudsmithAPI.get("namespaces/?sort=slug");
    }

    const WorkspaceNodes = [];
    if (workspaces) {
      for (const workspace of workspaces) {
        const workspaceNode = require("../models/workspaceNode");
        const workspaceNodeInst = new workspaceNode(workspace, this.context);
        WorkspaceNodes.push(workspaceNodeInst);
      }
    }
    return WorkspaceNodes;
  }
}

module.exports = { CloudsmithProvider };
