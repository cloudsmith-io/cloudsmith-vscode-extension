const vscode = require("vscode");
const path = require("path");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const RepositoryNode = require("./repositoryNode");

class WorkspaceNode {
  constructor(item, context) {
    this.context = context;
    this.name = item.name;
    this.slug = item.slug;

    this.repos = [];
    this.page = 1;
    this.pageSize = 30; // Adjust to your API’s preferred size
    this.hasMore = true;
    this.loading = false;
  }

  getTreeItem() {
    const iconPath = {
      light: path.join(__filename, "..", "..", "media", "workspace_light.svg"),
      dark: path.join(__filename, "..", "..", "media", "workspace_dark.svg"),
    };
    return {
      label: this.name,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: "workspace",
      iconPath,
    };
  }

  async getRepositories(loadMore = false) {
    if (this.loading || (!this.hasMore && loadMore)) return [];

    this.loading = true;

    try {
      const cloudsmithAPI = new CloudsmithAPI(this.context);
      const workspace = this.slug;

      // Example API: adjust query params based on your endpoint
      const url = `repos/${workspace}/?sort=name&page=${this.page}&page_size=${this.pageSize}`;
      const repositories = await cloudsmithAPI.get(url);

      if (!repositories || repositories.length === 0) {
        this.hasMore = false;
        return [];
      }

      const repoNodes = repositories.map(
        (repo) => new RepositoryNode(repo, this.name, this.context)
      );

      if (loadMore) {
        this.repos.push(...repoNodes);
      } else {
        this.repos = repoNodes;
      }

      // Determine if more pages exist
      if (repositories.length < this.pageSize) {
        this.hasMore = false;
      } else {
        this.page += 1;
      }

      this.context.globalState.update("CloudsmithCache", {
        name: "Repositories",
        lastSync: Date.now(),
        repositories: this.repos,
      });

      return repoNodes;
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to fetch repositories: ${err.message}`);
      this.hasMore = false;
      return [];
    } finally {
      this.loading = false;
    }
  }

  async getChildren() {
    // Initial load
    if (this.repos.length === 0) {
      await this.getRepositories();
    }

    const children = [...this.repos];

    // Append “Load more…” node if more pages exist
    if (this.hasMore) {
      const loadMoreItem = new vscode.TreeItem(
        this.loading ? "Loading…" : "Load more…",
        vscode.TreeItemCollapsibleState.None
      );
      loadMoreItem.iconPath = new vscode.ThemeIcon(this.loading ? "sync~spin" : "chevron-down");
      loadMoreItem.contextValue = "loadMoreRepo";
      loadMoreItem.command = {
        command: "cloudsmith-vsc.loadMoreRepos",
        title: "Load More",
        arguments: [this],
      };
      children.push(loadMoreItem);
    }

    return children;
  }
}

module.exports = WorkspaceNode;
