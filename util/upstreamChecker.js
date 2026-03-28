// Upstream proxy resolution checker.
// Provides a "what if I pull this?" dry run for packages that don't exist locally.

const { CloudsmithAPI } = require("./cloudsmithAPI");
const { CredentialManager } = require("./credentialManager");
const { SearchQueryBuilder } = require("./searchQueryBuilder");
const {
  getSupportedUpstreamFormats,
  SUPPORTED_UPSTREAM_FORMATS,
} = require("./upstreamFormats");
const UPSTREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const UPSTREAM_FETCH_BATCH_SIZE = 5;
const BENIGN_UPSTREAM_FORMAT_STATUS_CODES = new Set([400, 404, 405, 422]);

function getUpstreamCacheKey(workspace, repo, formats = SUPPORTED_UPSTREAM_FORMATS) {
  const normalizedFormats = getSupportedUpstreamFormats(formats);
  const isAllFormats =
    normalizedFormats.length === SUPPORTED_UPSTREAM_FORMATS.length &&
    normalizedFormats.every((format, index) => format === SUPPORTED_UPSTREAM_FORMATS[index]);

  if (isAllFormats) {
    return `cloudsmith-upstreams:all:${workspace}:${repo}`;
  }

  return `cloudsmith-upstreams:formats:${workspace}:${repo}:${normalizedFormats.join(",")}`;
}

function getUpstreamErrorStatusCode(message) {
  const normalized = typeof message === "string" ? message.toLowerCase() : "";
  const statusMatch = normalized.match(/response status:\s*(\d{3})/);
  if (!statusMatch) {
    return null;
  }

  return Number(statusMatch[1]);
}

function isBenignUpstreamFormatError(message) {
  const normalized = typeof message === "string" ? message.toLowerCase() : "";
  if (!normalized) {
    return false;
  }

  const statusCode = getUpstreamErrorStatusCode(normalized);
  if (statusCode !== null) {
    return BENIGN_UPSTREAM_FORMAT_STATUS_CODES.has(statusCode);
  }

  const benignKeywords = [
    "not found",
    "unsupported",
    "not applicable",
    "unknown format",
    "no upstream",
    "does not exist",
  ];

  if (benignKeywords.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  return false;
}

function isWarningWorthyUpstreamFormatError(message) {
  const normalized = typeof message === "string" ? message.toLowerCase() : "";
  if (!normalized) {
    return true;
  }

  return !isBenignUpstreamFormatError(normalized);
}

function getUpstreamRequestOptions(apiKey, signal) {
  const headers = {
    accept: "application/json",
    "content-type": "application/json",
  };

  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  return {
    method: "GET",
    headers,
    signal,
  };
}

function sortUpstreams(left, right) {
  const leftName = typeof left.name === "string" ? left.name : "";
  const rightName = typeof right.name === "string" ? right.name : "";
  if (leftName !== rightName) {
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  }

  const leftFormat = typeof left._format === "string"
    ? left._format
    : (typeof left.format === "string" ? left.format : "");
  const rightFormat = typeof right._format === "string"
    ? right._format
    : (typeof right.format === "string" ? right.format : "");

  return leftFormat.localeCompare(rightFormat, undefined, { sensitivity: "base" });
}

async function fetchFormatUpstreams(api, workspace, repo, format, apiKey, signal) {
  if (signal && signal.aborted) {
    return { format, status: "aborted", upstreams: [] };
  }

  const result = await api.makeRequest(
    `repos/${workspace}/${repo}/upstream/${format}/`,
    getUpstreamRequestOptions(apiKey, signal)
  );

  if (signal && signal.aborted) {
    return { format, status: "aborted", upstreams: [] };
  }

  if (typeof result === "string") {
    if (isWarningWorthyUpstreamFormatError(result)) {
      return { format, status: "failed", error: result, upstreams: [] };
    }

    return { format, status: "loaded", upstreams: [] };
  }

  if (!Array.isArray(result)) {
    return {
      format,
      status: "failed",
      error: `Unexpected upstream response for format "${format}".`,
      upstreams: [],
    };
  }

  return {
    format,
    status: "loaded",
    upstreams: result.map((upstream) => ({
      ...upstream,
      _format: format,
      format,
    })),
  };
}

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

  async getUpstreamDataForFormats(workspace, repo, formats, options = {}) {
    const { signal } = options;
    const requestedFormats = getSupportedUpstreamFormats(formats);

    if (signal && signal.aborted) {
      return null;
    }

    if (requestedFormats.length === 0) {
      return {
        upstreams: [],
        active: 0,
        total: 0,
        failedFormats: [],
        successfulFormats: 0,
      };
    }

    const cacheKey = getUpstreamCacheKey(workspace, repo, requestedFormats);
    const cached = this.context && this.context.globalState
      ? this.context.globalState.get(cacheKey)
      : null;

    if (
      cached &&
      Array.isArray(cached.upstreams) &&
      typeof cached.active === "number" &&
      typeof cached.total === "number" &&
      Array.isArray(cached.failedFormats) &&
      typeof cached.successfulFormats === "number" &&
      cached.timestamp &&
      (Date.now() - cached.timestamp) < UPSTREAM_CACHE_TTL_MS
    ) {
      return {
        upstreams: cached.upstreams,
        active: cached.active,
        total: cached.total,
        failedFormats: cached.failedFormats,
        successfulFormats: cached.successfulFormats,
      };
    }

    let apiKey = null;
    try {
      const credentialManager = new CredentialManager(this.context);
      apiKey = await credentialManager.getApiKey();
    } catch {
      apiKey = null;
    }

    if (signal && signal.aborted) {
      return null;
    }

    const upstreams = [];
    const failedFormats = [];
    let successfulFormats = 0;

    for (let index = 0; index < requestedFormats.length; index += UPSTREAM_FETCH_BATCH_SIZE) {
      if (signal && signal.aborted) {
        return null;
      }

      const batch = requestedFormats.slice(index, index + UPSTREAM_FETCH_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((format) => fetchFormatUpstreams(this.api, workspace, repo, format, apiKey, signal))
      );

      if (signal && signal.aborted) {
        return null;
      }

      for (const result of batchResults) {
        if (result.status === "aborted") {
          return null;
        }

        if (result.status === "failed") {
          failedFormats.push(result.format);
          continue;
        }

        if (result.status !== "loaded") {
          continue;
        }

        successfulFormats += 1;
        upstreams.push(...result.upstreams);
      }
    }

    upstreams.sort(sortUpstreams);
    const active = upstreams.filter((upstream) => upstream.is_active !== false).length;
    const response = {
      upstreams,
      active,
      total: upstreams.length,
      failedFormats,
      successfulFormats,
    };

    if (
      !signal?.aborted &&
      failedFormats.length === 0 &&
      this.context &&
      this.context.globalState
    ) {
      await this.context.globalState.update(cacheKey, {
        timestamp: Date.now(),
        ...response,
      });
    }

    return response;
  }

  async getAllUpstreamData(workspace, repo, options = {}) {
    return this.getUpstreamDataForFormats(workspace, repo, SUPPORTED_UPSTREAM_FORMATS, options);
  }

  async getAllUpstreams(workspace, repo, options = {}) {
    const result = await this.getAllUpstreamData(workspace, repo, options);
    if (result === null) {
      return { data: [], error: null, aborted: true };
    }

    if (result.failedFormats.length > 0 && result.upstreams.length === 0) {
      return {
        data: result.upstreams,
        error: `Could not load upstream data for: ${result.failedFormats.join(", ")}`,
      };
    }

    return { data: result.upstreams, error: null };
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

async function getAllUpstreamData(context, workspace, repo, options = {}) {
  const checker = new UpstreamChecker(context);
  return checker.getAllUpstreamData(workspace, repo, options);
}

async function getUpstreamDataForFormats(context, workspace, repo, formats, options = {}) {
  const checker = new UpstreamChecker(context);
  return checker.getUpstreamDataForFormats(workspace, repo, formats, options);
}

module.exports = {
  getAllUpstreamData,
  getUpstreamDataForFormats,
  isBenignUpstreamFormatError,
  SUPPORTED_UPSTREAM_FORMATS,
  UpstreamChecker,
};
