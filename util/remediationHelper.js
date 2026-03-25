// Remediation helper - finds safe alternative versions of a package

class RemediationHelper {
  constructor(cloudsmithAPI) {
    this.api = cloudsmithAPI;
  }

  /**
   * Search for clean versions of a package within a specific repo.
   * Returns array of package objects sorted by version descending, or [] on error.
   *
   * @param   {string} workspace  Workspace/owner slug.
   * @param   {string} repo       Repository slug.
   * @param   {string} packageName Package name.
   * @param   {string} format     Package format (e.g., 'python', 'npm').
   * @returns {Array} Array of package objects.
   */
  async findSafeVersions(workspace, repo, packageName, format) {
    const query = `name:^${packageName}$ AND format:${format} AND NOT status:quarantined AND deny_policy_violated:false`;
    const endpoint = `packages/${workspace}/${repo}/?query=${encodeURIComponent(query)}&sort=-version&page_size=10`;

    const result = await this.api.get(endpoint);

    if (typeof result === "string") {
      return { success: false, versions: [], error: result };
    }
    if (!result || !Array.isArray(result)) {
      return { success: false, versions: [], error: "Unexpected API response" };
    }
    return { success: true, versions: result, error: null };
  }

  /**
   * Search workspace-wide for clean versions of a package across all repos.
   * Returns array of package objects sorted by version descending, or [] on error.
   *
   * @param   {string} workspace   Workspace/owner slug.
   * @param   {string} packageName Package name.
   * @param   {string} format      Package format (e.g., 'python', 'npm').
   * @returns {Array} Array of package objects.
   */
  async findSafeVersionsAcrossRepos(workspace, packageName, format) {
    const query = `name:^${packageName}$ AND format:${format} AND NOT status:quarantined AND deny_policy_violated:false`;
    const endpoint = `packages/${workspace}/?query=${encodeURIComponent(query)}&sort=-version&page_size=10`;

    const result = await this.api.get(endpoint);

    if (typeof result === "string") {
      return { success: false, versions: [], error: result };
    }
    if (!result || !Array.isArray(result)) {
      return { success: false, versions: [], error: "Unexpected API response" };
    }
    return { success: true, versions: result, error: null };
  }
}

module.exports = { RemediationHelper };
