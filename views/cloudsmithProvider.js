// This class handles the main Cloudsmith view. Workspaces are generated and populated here.
// When cloudsmith-vsc.defaultWorkspace is set, repositories load directly as root items.

const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { ConnectionManager } = require("../util/connectionManager");
const InfoNode = require("../models/infoNode");

class CloudsmithProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._defaultWorkspaceFallbackHandler = null;
    this._treeView = null;
  }

  getTreeItem(element) {
    return element.getTreeItem();
  }

  getChildren(element) {
    if (!element) {
      // Root level — check if default workspace is configured
      const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
      const defaultWorkspace = config.get("defaultWorkspace");

      if (defaultWorkspace) {
        return this.getRepositories(defaultWorkspace);
      }
      return this.getWorkspaces();
    }
    return element.getChildren();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  setDefaultWorkspaceFallbackHandler(handler) {
    this._defaultWorkspaceFallbackHandler = handler;
  }

  setTreeView(treeView) {
    this._treeView = treeView;
  }

  async getWorkspaces() {
    const context = this.context;
    const cloudsmithAPI = new CloudsmithAPI(context);
    const connectionManager = new ConnectionManager(context);
    let workspaces = "";

    if (this._treeView) {
      this._treeView.message = "Loading...";
    }

    const connStatus = await connectionManager.connect(context);

    if (connStatus === "false" || connStatus === "error") {
      if (this._treeView) {
        this._treeView.message = undefined;
      }
      return [new InfoNode(
        "Connect to Cloudsmith",
        "Use the key icon above to set up API key, Service Account Token, CLI import, or SSO",
        "Set up your Cloudsmith authentication to get started",
        "plug",
        undefined,
        { command: "cloudsmith-vsc.configureCredentials", title: "Set Up Authentication" }
      )];
    }

    workspaces = await cloudsmithAPI.get("namespaces/?sort=slug");

    if (this._treeView) {
      this._treeView.message = undefined;
    }

    const WorkspaceNodes = [];
    if (typeof workspaces === 'string' || !workspaces || !Array.isArray(workspaces)) {
      return [new InfoNode(
        "Could not load workspaces",
        "Check your connection and credentials",
        "The Cloudsmith API returned an error. Try refreshing or reconfiguring credentials.",
        "warning"
      )];
    }
    if (workspaces.length > 0) {
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

  /**
   * Load repositories directly for a specific workspace (skipping workspace level).
   * Used when cloudsmith-vsc.defaultWorkspace is configured.
   *
   * @param   {string} workspaceSlug  The workspace slug to load repos for.
   * @returns {Array} Array of RepositoryNode instances, or empty on error.
   */
  async getRepositories(workspaceSlug) {
    const context = this.context;
    const cloudsmithAPI = new CloudsmithAPI(context);
    const connectionManager = new ConnectionManager(context);

    if (this._treeView) {
      this._treeView.message = "Loading...";
    }

    const connStatus = await connectionManager.connect(context);
    if (connStatus === "false" || connStatus === "error") {
      if (this._treeView) {
        this._treeView.message = undefined;
      }
      return [new InfoNode(
        "Connect to Cloudsmith",
        "Use the key icon above to set up API key, Service Account Token, CLI import, or SSO",
        "Set up your Cloudsmith authentication to get started",
        "plug",
        undefined,
        { command: "cloudsmith-vsc.configureCredentials", title: "Set Up Authentication" }
      )];
    }

    const repos = await cloudsmithAPI.get(`repos/${workspaceSlug}/?sort=name`);

    if (this._treeView) {
      this._treeView.message = undefined;
    }

    if (typeof repos === 'string' || !repos || !Array.isArray(repos)) {
      if (this._defaultWorkspaceFallbackHandler) {
        this._defaultWorkspaceFallbackHandler(workspaceSlug);
      } else {
        vscode.window.showWarningMessage(
          `Could not access workspace "${workspaceSlug}". Showing all workspaces.`
        );
      }
      // Fall back to full workspace tree
      return this.getWorkspaces();
    }

    const RepositoryNode = require("../models/repositoryNode");
    const RepositoryNodes = [];
    for (const repo of repos) {
      // Pass workspaceSlug as the workspace parameter so downstream calls work
      const repoNode = new RepositoryNode(repo, workspaceSlug, context);
      RepositoryNodes.push(repoNode);
    }

    // Also update the workspace cache so search commands can find it
    context.globalState.update('CloudsmithCache', {
      name: 'Workspaces',
      lastSync: Date.now(),
      workspaces: [{ name: workspaceSlug, slug: workspaceSlug }]
    });

    return RepositoryNodes;
  }
}

module.exports = { CloudsmithProvider };
