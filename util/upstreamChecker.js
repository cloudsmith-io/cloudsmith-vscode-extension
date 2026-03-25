// Upstream proxy resolution checker.
// Provides a "what if I pull this?" dry run for packages that don't exist locally.

const { CloudsmithAPI } = require("./cloudsmithAPI");

class UpstreamChecker {
  constructor(context) {
    this.context = context;
    this.api = new CloudsmithAPI(context);
  }

  /**
   * Check if a package exists locally in a repository.
   *
   * @param   {string} workspace  Workspace slug.
   * @param   {string} repo       Repository slug.
   * @param   {string} name       Package name.
   * @param   {string} format     Package format (e.g., 'python', 'npm').
   * @returns {Object|null}       Package object if found, null otherwise.
   */
  async existsLocally(workspace, repo, name, format) {
    const query = encodeURIComponent(`name:^${name}$ AND format:${format}`);
    const result = await this.api.get(
      `packages/${workspace}/${repo}/?query=${query}&page_size=1`
    );
    if (typeof result === "string") {
      return { data: null, error: result };
    }
    if (!Array.isArray(result) || result.length === 0) {
      return { data: null, error: null };
    }
    return { data: result[0], error: null };
  }

  /**
   * Get active upstream configurations for a specific format in a repository.
   *
   * @param   {string} workspace  Workspace slug.
   * @param   {string} repo       Repository slug.
   * @param   {string} format     Package format slug.
   * @returns {Array}             Array of upstream config objects.
   */
  async getUpstreamsForFormat(workspace, repo, format) {
    const result = await this.api.get(`repos/${workspace}/${repo}/upstream/${format}/`);
    if (typeof result === "string") {
      return { data: [], error: result };
    }
    if (!Array.isArray(result)) {
      return { data: [], error: null };
    }
    return { data: result, error: null };
  }

  /**
   * Simulate policy evaluation for a workspace.
   * Uses the v2 API endpoint.
   *
   * @param   {string} workspace  Workspace slug.
   * @returns {Object|null}       Policy simulation results, or null on error.
   */
  async simulatePolicies(workspace) {
    const result = await this.api.getV2(
      `workspaces/${workspace}/policies/simulate/`
    );
    if (typeof result === "string") {
      console.warn(`[UpstreamChecker] Policy simulation error: ${result}`);
      return { data: null, error: result };
    }
    return { data: result, error: null };
  }

  /**
   * Orchestrate a full upstream resolution preview.
   * Checks local existence, upstream configs, and active policies.
   *
   * @param   {string} workspace  Workspace slug.
   * @param   {string} repo       Repository slug.
   * @param   {string} name       Package name.
   * @param   {string} format     Package format.
   * @returns {Object}            Combined result with local, upstream, and policy info.
   */
  async previewResolution(workspace, repo, name, format) {
    // Run all checks in parallel
    const [localPkg, upstreams, policies] = await Promise.all([
      this.existsLocally(workspace, repo, name, format),
      this.getUpstreamsForFormat(workspace, repo, format),
      this.simulatePolicies(workspace),
    ]);

    const upstreamList = Array.isArray(upstreams.data) ? upstreams.data : [];
    const activeUpstreams = upstreamList.filter(u => u.is_active !== false);

    return {
      name,
      format,
      workspace,
      repo,
      local: localPkg,
      upstreams: {
        data: {
          total: upstreamList.length,
          active: activeUpstreams.length,
          configs: upstreamList,
        },
        error: upstreams.error,
      },
      policies,
      canResolveViaUpstream: activeUpstreams.length > 0,
    };
  }
}

module.exports = { UpstreamChecker };
