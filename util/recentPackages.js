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
  // Deduplicate by name + version + repository
  const key = `${pkg.name}:${pkg.version || ""}:${pkg.repository || ""}`;
  const idx = _recent.findIndex(p =>
    `${p.name}:${p.version || ""}:${p.repository || ""}` === key
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
