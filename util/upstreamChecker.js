// Upstream proxy resolution checker.
// Provides a "what if I pull this?" dry run for packages that don't exist locally.

const { CloudsmithAPI } = require("./cloudsmithAPI");
const { CredentialManager } = require("./credentialManager");
const { SearchQueryBuilder } = require("./searchQueryBuilder");

const SUPPORTED_UPSTREAM_FORMATS = [
  "deb", "docker", "maven", "npm", "python",
  "ruby", "dart", "helm", "nuget", "cargo",
  "rpm", "cran", "swift", "go", "hex",
  "composer", "conda", "conan", "p2", "terraform",
  "raw",
];
const UPSTREAM_FETCH_BATCH_SIZE = 5;
const UPSTREAM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REPOSITORY_UPSTREAM_CACHE_KEY_PREFIX = "cloudsmith-upstreams:v2";

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
    const qb = new SearchQueryBuilder();
    const query = encodeURIComponent(qb.name(name).format(format).build());
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
   * Load all upstream configurations for a repository across every supported format.
   * Results are cached in globalState for 10 minutes when the fetch completes without failures.
   *
   * @param   {string} workspace Workspace slug.
   * @param   {string} repo      Repository slug.
   * @param   {Object} options   Optional request settings.
   * @returns {Object}           Aggregated upstream state.
   */
  async getRepositoryUpstreamState(workspace, repo, options = {}) {
    const cachedState = this._getCachedRepositoryUpstreamState(workspace, repo);
    if (cachedState) {
      return cachedState;
    }

    const signal = options && options.signal ? options.signal : null;
    const fetchState = await this._fetchRepositoryUpstreamState(workspace, repo, signal);

    if (!signal?.aborted && fetchState.failedFormats.length === 0) {
      await this._cacheRepositoryUpstreamState(workspace, repo, fetchState);
    }

    return fetchState;
  }

  /**
   * Load the flattened upstream list for a repository across every supported format.
   *
   * @param   {string} workspace Workspace slug.
   * @param   {string} repo      Repository slug.
   * @param   {Object} options   Optional request settings.
   * @returns {Array}            Flattened upstream list.
   */
  async getRepositoryUpstreams(workspace, repo, options = {}) {
    const state = await this.getRepositoryUpstreamState(workspace, repo, options);
    return state.upstreams;
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

  _getRepositoryUpstreamCacheKey(workspace, repo) {
    return `${REPOSITORY_UPSTREAM_CACHE_KEY_PREFIX}:${workspace}:${repo}`;
  }

  _getCachedRepositoryUpstreamState(workspace, repo) {
    const globalState = this.context && this.context.globalState;
    if (!globalState || typeof globalState.get !== "function") {
      return null;
    }

    const cached = globalState.get(this._getRepositoryUpstreamCacheKey(workspace, repo));
    if (!cached || (Date.now() - cached.timestamp) >= UPSTREAM_CACHE_TTL_MS) {
      return null;
    }

    const groupedUpstreams = this._deserializeGroupedUpstreams(cached.groupedUpstreams);
    const successfulFormats = typeof cached.successfulFormats === "number"
      ? cached.successfulFormats
      : SUPPORTED_UPSTREAM_FORMATS.length;

    return this._buildRepositoryUpstreamState(groupedUpstreams, [], successfulFormats);
  }

  async _cacheRepositoryUpstreamState(workspace, repo, state) {
    const globalState = this.context && this.context.globalState;
    if (!globalState || typeof globalState.update !== "function") {
      return;
    }

    const groupedUpstreams = {};
    for (const format of SUPPORTED_UPSTREAM_FORMATS) {
      const upstreams = state.groupedUpstreams.get(format);
      if (Array.isArray(upstreams) && upstreams.length > 0) {
        groupedUpstreams[format] = upstreams;
      }
    }

    await globalState.update(this._getRepositoryUpstreamCacheKey(workspace, repo), {
      timestamp: Date.now(),
      successfulFormats: state.successfulFormats,
      groupedUpstreams,
    });
  }

  async _fetchRepositoryUpstreamState(workspace, repo, signal) {
    const groupedUpstreams = new Map();
    const failedFormats = [];
    let successfulFormats = 0;
    let apiKey = null;

    try {
      const credentialManager = new CredentialManager(this.context);
      apiKey = await credentialManager.getApiKey();
    } catch (error) {
      if (this._isAbortError(error) || signal?.aborted) {
        return this._buildRepositoryUpstreamState(groupedUpstreams, failedFormats, successfulFormats);
      }

      return this._buildRepositoryUpstreamState(
        groupedUpstreams,
        [...SUPPORTED_UPSTREAM_FORMATS],
        successfulFormats
      );
    }

    for (
      let index = 0;
      index < SUPPORTED_UPSTREAM_FORMATS.length;
      index += UPSTREAM_FETCH_BATCH_SIZE
    ) {
      if (signal?.aborted) {
        return this._buildRepositoryUpstreamState(groupedUpstreams, failedFormats, successfulFormats);
      }

      const batch = SUPPORTED_UPSTREAM_FORMATS.slice(
        index,
        index + UPSTREAM_FETCH_BATCH_SIZE
      );

      const batchResults = await Promise.all(
        batch.map((format) =>
          this._fetchFormatUpstreams(workspace, repo, format, apiKey, signal)
        )
      );

      if (signal?.aborted) {
        return this._buildRepositoryUpstreamState(groupedUpstreams, failedFormats, successfulFormats);
      }

      for (const result of batchResults) {
        if (result.status === "failed") {
          failedFormats.push(result.format);
          continue;
        }

        if (result.status !== "loaded") {
          continue;
        }

        successfulFormats += 1;

        if (result.upstreams.length === 0) {
          continue;
        }

        groupedUpstreams.set(result.format, result.upstreams);
      }
    }

    return this._buildRepositoryUpstreamState(groupedUpstreams, failedFormats, successfulFormats);
  }

  async _fetchFormatUpstreams(workspace, repo, format, apiKey, signal) {
    try {
      if (signal?.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      const result = await this.api.makeRequest(
        `repos/${workspace}/${repo}/upstream/${format}/`,
        this._getRequestOptions(apiKey, signal)
      );

      if (signal?.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      if (typeof result === "string") {
        if (this._isWarningWorthyFormatError(result)) {
          return { format, status: "failed", upstreams: [] };
        }
        return { format, status: "loaded", upstreams: [] };
      }

      if (!Array.isArray(result)) {
        return { format, status: "failed", upstreams: [] };
      }

      return {
        format,
        status: "loaded",
        upstreams: result.map((upstream) => ({ ...upstream, format })),
      };
    } catch (error) {
      if (this._isAbortError(error) || signal?.aborted) {
        return { format, status: "aborted", upstreams: [] };
      }

      const message = error && error.message ? error.message : "";
      if (!this._isWarningWorthyFormatError(message)) {
        return { format, status: "loaded", upstreams: [] };
      }

      return { format, status: "failed", upstreams: [] };
    }
  }

  _buildRepositoryUpstreamState(groupedUpstreams, failedFormats, successfulFormats) {
    const normalizedGrouped = new Map();
    const upstreams = [];
    let active = 0;

    for (const format of SUPPORTED_UPSTREAM_FORMATS) {
      const formatUpstreams = Array.isArray(groupedUpstreams.get(format))
        ? groupedUpstreams.get(format).slice()
        : [];

      if (formatUpstreams.length === 0) {
        continue;
      }

      formatUpstreams.sort((left, right) => {
        const leftName = typeof left.name === "string" ? left.name : "";
        const rightName = typeof right.name === "string" ? right.name : "";
        return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
      });

      const taggedUpstreams = formatUpstreams.map((upstream) => ({
        ...upstream,
        format: typeof upstream.format === "string" && upstream.format
          ? upstream.format
          : format,
      }));

      normalizedGrouped.set(format, taggedUpstreams);
      upstreams.push(...taggedUpstreams);
      active += taggedUpstreams.filter((upstream) => upstream.is_active !== false).length;
    }

    return {
      groupedUpstreams: normalizedGrouped,
      failedFormats: Array.isArray(failedFormats) ? failedFormats.slice() : [],
      successfulFormats,
      upstreams,
      active,
      total: upstreams.length,
    };
  }

  _deserializeGroupedUpstreams(groupedUpstreams) {
    const grouped = new Map();
    const source = groupedUpstreams && typeof groupedUpstreams === "object"
      ? groupedUpstreams
      : {};

    for (const format of SUPPORTED_UPSTREAM_FORMATS) {
      if (Array.isArray(source[format])) {
        grouped.set(format, source[format].slice());
      }
    }

    return grouped;
  }

  _getRequestOptions(apiKey, signal) {
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
    };

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const requestOptions = {
      method: "GET",
      headers,
    };

    if (signal) {
      requestOptions.signal = signal;
    }

    return requestOptions;
  }

  _isAbortError(error) {
    return error && (error.name === "AbortError" || error.code === "ABORT_ERR");
  }

  _isWarningWorthyFormatError(message) {
    const normalized = typeof message === "string" ? message.toLowerCase() : "";
    if (!normalized) {
      return true;
    }

    const benignKeywords = [
      "response status: 404",
      "not found",
      "unsupported",
      "not applicable",
      "unknown format",
      "no upstream",
      "does not exist",
    ];
    if (benignKeywords.some((keyword) => normalized.includes(keyword))) {
      return false;
    }

    const statusMatch = normalized.match(/response status:\s*(\d{3})/);
    if (statusMatch) {
      const statusCode = Number(statusMatch[1]);
      if (
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 407 ||
        statusCode === 408 ||
        statusCode === 429
      ) {
        return true;
      }
      if (statusCode >= 500) {
        return true;
      }
      if (statusCode >= 400) {
        return true;
      }
    }

    const warningKeywords = [
      "blocked ",
      "redirect",
      "fetch failed",
      "network",
      "timed out",
      "timeout",
      "unauthorized",
      "forbidden",
      "permission",
      "access denied",
      "server error",
      "bad gateway",
      "service unavailable",
      "gateway timeout",
      "econn",
      "enotfound",
      "eai_again",
      "socket",
      "tls",
      "certificate",
    ];

    if (warningKeywords.some((keyword) => normalized.includes(keyword))) {
      return true;
    }

    return true;
  }
}

module.exports = {
  UpstreamChecker,
  SUPPORTED_UPSTREAM_FORMATS,
  UPSTREAM_FETCH_BATCH_SIZE,
  UPSTREAM_CACHE_TTL_MS,
};
