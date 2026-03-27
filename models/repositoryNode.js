// Repo node treeview

const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const UpstreamIndicatorNode = require("./upstreamIndicatorNode");
const { activeFilters } = require("../util/filterState");
const InfoNode = require("./infoNode");
const { EntitlementSummaryNode } = require("./entitlementNode");

const UPSTREAM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class RepositoryNode {
  constructor(repo, workspace, context) {
    this.context = context;
    this.slug = repo.slug;
    this.slug_perm = repo.slug_perm;
    this.name = repo.name;
    this.workspace = workspace;
    this.storageRegion = repo.storage_region || repo.region || null;
  }

  /** Get the active filter from the module-level singleton Map. */
  _getActiveFilter() {
    return activeFilters.get(`${this.workspace}/${this.slug}`) || null;
  }

  _getStorageRegionLabel(region, depth = 0) {
    if (region == null) {
      return null;
    }

    if (
      typeof region === "string" ||
      typeof region === "number" ||
      typeof region === "boolean"
    ) {
      return String(region);
    }

    if (typeof region !== "object") {
      return null;
    }

    if (depth >= 3) {
      try {
        return JSON.stringify(region);
      } catch {
        return "Unknown";
      }
    }

    const directKeys = ["name", "label", "slug", "value"];
    for (const key of directKeys) {
      if (region[key] != null) {
        const directLabel = this._getStorageRegionLabel(region[key], depth + 1);
        if (directLabel) {
          return directLabel;
        }
      }
    }

    const nestedKeys = ["region", "storage_region", "details", "location"];
    for (const key of nestedKeys) {
      if (region[key] != null) {
        const nestedLabel = this._getStorageRegionLabel(region[key], depth + 1);
        if (nestedLabel) {
          return nestedLabel;
        }
      }
    }

    for (const value of Object.values(region)) {
      if (value != null && typeof value === "object") {
        const nestedLabel = this._getStorageRegionLabel(value, depth + 1);
        if (nestedLabel) {
          return nestedLabel;
        }
      }
    }

    try {
      return JSON.stringify(region);
    } catch {
      return "Unknown";
    }
  }

  getTreeItem() {
    const repo = this.name;
    const activeFilter = this._getActiveFilter();
    const filterLabel = activeFilter
      ? `Filter: ${activeFilter.label || activeFilter}`
      : undefined;

    return {
      label: repo,
      description: filterLabel,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: activeFilter ? "repositoryFiltered" : "repository",
    };
  }

  async getPackages() {
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    let packages = '';
    

    let workspace = this.workspace;
    let repo = this.slug;
    let groupContext = { "repo": repo, "workspace": workspace  };

    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const maxPackages = await config.get("showMaxPackages"); // get legacy app setting from configuration settings
    const groupByPackageGroup = await config.get("groupByPackageGroups");

    const activeFilter = this._getActiveFilter();
    const filterQuery = activeFilter ? (activeFilter.query || activeFilter) : null;
    const filterParam = filterQuery ? `&query=${encodeURIComponent(filterQuery)}` : '';


    let apiFailed = false;
    if (!groupByPackageGroup) {
      const apiUrl = "packages/" + workspace + "/" + repo + "/?sort=-date&page_size=" + maxPackages + filterParam;
      packages = await cloudsmithAPI.get(apiUrl);
      // Guard against error string from API
      if (typeof packages === 'string' || !Array.isArray(packages)) {
        apiFailed = true;
        packages = [];
      }
    } else {
      const groups = await cloudsmithAPI.get(
        "packages/" + workspace + "/" + repo + "/groups/?sort=-last_push&page_size=" + maxPackages + filterParam
      );
      // Guard against error string from API
      if (typeof groups === 'string' || !groups || !groups.results) {
        apiFailed = true;
        packages = [];
      } else {
        packages = groups.results;
      }
    }
    this._lastApiFailed = apiFailed;

    const PackageNodes = [];
    if (packages && packages.length > 0) {
      for (const pkg of packages) {
        if (!groupByPackageGroup) {
          const packageNode = require("./packageNode");
          let packageNodeInst = new packageNode(pkg, this.context);
          PackageNodes.push(packageNodeInst);
        } else {
          const packageGroupsNode = require("./packageGroupsNode");
          const groupPkg = { ...pkg, ...groupContext };
          const packageGroupNodeInst = new packageGroupsNode(groupPkg, this.context);
          PackageNodes.push(packageGroupNodeInst);
        }
      }
    }
    return PackageNodes;
  }

  /**
   * Fetch upstream configs for this repo by inferring formats from loaded packages.
   * Results are cached in globalState for 10 minutes.
   *
   * @param   packageNodes  Array of PackageNode instances to infer formats from.
   * @returns Array of upstream config objects (may be empty).
   */
  async getUpstreams(packageNodes) {
    const workspace = this.workspace;
    const repo = this.slug;
    const cacheKey = `cloudsmith-upstreams:${workspace}:${repo}`;

    // Check cache
    const cached = this.context.globalState.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < UPSTREAM_CACHE_TTL_MS) {
      return cached.upstreams;
    }

    // Infer unique formats from loaded packages
    const formats = new Set();
    for (const node of packageNodes) {
      const format = node.format || (node.pkgDetails && node.pkgDetails.format);
      if (format) {
        formats.add(format);
      }
    }

    if (formats.size === 0) {
      return [];
    }

    // Fetch upstream configs for each format in parallel
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const promises = Array.from(formats).map(format =>
      cloudsmithAPI.getUpstreams(workspace, repo, format)
    );
    const results = await Promise.all(promises);
    const allUpstreams = results.flat();

    // Cache the results
    this.context.globalState.update(cacheKey, {
      timestamp: Date.now(),
      upstreams: allUpstreams,
    });

    return allUpstreams;
  }

  /**
   * Fetch entitlement tokens for this repository.
   * @returns {Array} Array of entitlement objects.
   */
  async getEntitlements() {
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const result = await cloudsmithAPI.get(
      `entitlements/${this.workspace}/${this.slug}/?page_size=50`
    );
    if (typeof result === "string" || !Array.isArray(result)) {
      return [];
    }
    return result;
  }

  async getChildren() {
    const packages = await this.getPackages();
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const showEntitlements = config.get("showEntitlements");

    const children = [];

    // Fetch upstreams lazily (only when repo is expanded) using loaded packages
    if (packages.length > 0) {
      const upstreams = await this.getUpstreams(packages);
      if (upstreams.length > 0) {
        children.push(new UpstreamIndicatorNode(
          upstreams,
          {
            workspace: this.workspace,
            slug: this.slug,
            name: this.name,
          },
          this.context
        ));
      }
    }

    if (this.storageRegion) {
      const regionLabel = this._getStorageRegionLabel(this.storageRegion);

      children.push({
        getTreeItem: () => ({
          label: "Storage region",
          description: regionLabel,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          contextValue: "repoDetail",
          iconPath: new vscode.ThemeIcon("globe"),
        }),
        getChildren: () => [],
      });
    }

    // Entitlement tokens (Phase 12)
    if (showEntitlements) {
      try {
        const entitlements = await this.getEntitlements();
        if (entitlements.length > 0) {
          children.push(new EntitlementSummaryNode(entitlements, this.context));
        }
      } catch (e) {
        children.push(new InfoNode(
          "Could not load entitlement tokens",
          "",
          e.message || "Could not load entitlement tokens.",
          "warning"
        ));
      }
    }

    if (packages.length === 0) {
      const activeFilter = this._getActiveFilter();
      let placeholderNode;
      if (this._lastApiFailed) {
        placeholderNode = new InfoNode(
          "Failed to load packages",
          "Check the connection and refresh.",
          "The Cloudsmith API returned an error when loading packages for this repository.",
          "warning"
        );
      } else if (activeFilter) {
        const filterLabel = activeFilter.label || "custom query";
        placeholderNode = new InfoNode(
          "No packages match filter",
          filterLabel,
          "Select to change or clear the filter.",
          "filter",
          undefined,
          { command: "cloudsmith-vsc.changeFilter", title: "Change filter", arguments: [this] }
        );
      } else {
        placeholderNode = new InfoNode(
          "No packages",
          "",
          "Create or push a package to get started.",
          "info"
        );
      }
      children.push(placeholderNode);
    }

    // packages are already PackageNode or PackageGroupsNode instances from getPackages()
    // Push them directly — do NOT re-wrap in new packageNode(item)
    for (const node of packages) {
      children.push(node);
    }

    return children;
  }
}

module.exports = RepositoryNode;
