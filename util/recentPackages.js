// Circular buffer of recently interacted-with packages.
// Module singleton — same instance everywhere via CommonJS caching.

const MAX_RECENT = 10;
const _recent = [];

/**
 * Add a package to the recent list.
 * @param {Object} pkg  Must have at least { name, format, namespace, repository }.
 */
function add(pkg) {
  if (!pkg || !pkg.name) {
    return;
  }
  const workspace = pkg.cloudsmithWorkspace || pkg.namespace || "";
  const version = pkg.version || pkg.declaredVersion || "";
  // Deduplicate by workspace + name + version + repository
  const key = `${workspace}:${pkg.name}:${version}:${pkg.repository || ""}`;
  const idx = _recent.findIndex(p =>
    `${p.cloudsmithWorkspace || p.namespace || ""}:${p.name}:${p.version || ""}:${p.repository || ""}` === key
  );
  if (idx >= 0) {
    _recent.splice(idx, 1);
  }
  _recent.unshift({
    name: pkg.name,
    format: pkg.format,
    version: pkg.version || pkg.declaredVersion || null,
    namespace: pkg.namespace,
    repository: pkg.repository,
    slug_perm: pkg.slug_perm,
    slug_perm_raw: pkg.slug_perm_raw || null,
    slug: pkg.slug || null,
    num_vulnerabilities: pkg.num_vulnerabilities || 0,
    max_severity: pkg.max_severity || null,
    checksum_sha256: pkg.checksum_sha256 || null,
    cdn_url: pkg.cdn_url || null,
    filename: pkg.filename || null,
    cloudsmithWorkspace: pkg.cloudsmithWorkspace || pkg.namespace || null,
    cloudsmithRepo: pkg.cloudsmithRepo || pkg.repository || null,
  });
  if (_recent.length > MAX_RECENT) {
    _recent.length = MAX_RECENT;
  }
}

/**
 * Get all recent packages (most recent first).
 * @returns {Array}
 */
function getAll() {
  return _recent.slice();
}

module.exports = { add, getAll };
