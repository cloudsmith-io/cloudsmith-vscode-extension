// Repo node treeview

const vscode = require("vscode");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const UpstreamIndicatorNode = require("./upstreamIndicatorNode");
const { activeFilters } = require("../util/filterState");
const InfoNode = require("./infoNode");
const { EntitlementSummaryNode } = require("./entitlementNode");
const RepoMetricsNode = require("./repoMetricsNode");

const UPSTREAM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const QUOTA_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes


class RepositoryNode {
  constructor(repo, workspace, context) {
    this.context = context;
    this.slug = repo.slug;
    this.slug_perm = repo.slug_perm;
    this.name = repo.name;
    this.workspace = workspace;
  }

  /** Get the active filter from the module-level singleton Map. */
  _getActiveFilter() {
    return activeFilters.get(`${this.workspace}/${this.slug}`) || null;
  }

  getTreeItem() {
    const repo = this.name;
    const activeFilter = this._getActiveFilter();
    const filterLabel = activeFilter
      ? `filtered: ${activeFilter.label || activeFilter}`
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

  /**
   * Fetch workspace quota (cached for 30 minutes since it's workspace-level).
   * @returns {Object|null} Quota data or null on error.
   */
  async getQuota() {
    const cacheKey = `cloudsmith-quota:${this.workspace}`;
    const cached = this.context.globalState.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < QUOTA_CACHE_TTL_MS) {
      return cached.data;
    }

    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const endpoint = `quota/${this.workspace}/`;
    const result = await cloudsmithAPI.get(endpoint);
    if (typeof result === "string" || !result) {
      return null;
    }

    this.context.globalState.update(cacheKey, {
      timestamp: Date.now(),
      data: result,
    });
    return result;
  }

  /**
   * Fetch per-repo package metrics (aggregate download count).
   * @returns {Object} Metrics object with downloads count.
   */
  async getRepoMetrics() {
    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const result = await cloudsmithAPI.get(
      `metrics/packages/${this.workspace}/${this.slug}/?page_size=1`
    );
    if (typeof result === "string" || !result) {
      return {};
    }
    // The metrics endpoint may return an object or array
    if (Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    return result;
  }

  async getChildren() {
    const packages = await this.getPackages();
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const showEntitlements = config.get("showEntitlements");
    const showRepoMetrics = config.get("showRepoMetrics");

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

    // Entitlement tokens (Phase 12)
    if (showEntitlements) {
      try {
        const entitlements = await this.getEntitlements();
        if (entitlements.length > 0) {
          children.push(new EntitlementSummaryNode(entitlements, this.context));
        }
      } catch (e) {
        children.push(new InfoNode(
          "Entitlements: failed to load",
          "",
          e.message || "An error occurred loading entitlement tokens.",
          "warning"
        ));
      }
    }

    // Repository metrics (Phase 13)
    if (showRepoMetrics) {
      try {
        const [quota, metrics] = await Promise.all([
          this.getQuota(),
          this.getRepoMetrics(),
        ]);
        if (quota) {
          children.push(new RepoMetricsNode(quota, metrics, this.context));
        }
      } catch (e) {
        console.warn(`[RepoMetrics] Error loading metrics:`, e.message);
        children.push(new InfoNode(
          "Metrics: failed to load",
          "",
          e.message || "An error occurred loading repository metrics.",
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
          "Check your connection and try refreshing",
          "The Cloudsmith API returned an error when loading packages for this repository.",
          "warning"
        );
      } else if (activeFilter) {
        const filterLabel = activeFilter.label || "custom query";
        placeholderNode = new InfoNode(
          "No packages match filter",
          filterLabel,
          "Click to change or clear the filter",
          "filter",
          undefined,
          { command: "cloudsmith-vsc.changeFilter", title: "Change Filter", arguments: [this] }
        );
      } else {
        placeholderNode = new InfoNode(
          "Repository is empty",
          "",
          "This repository does not contain any packages.",
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
