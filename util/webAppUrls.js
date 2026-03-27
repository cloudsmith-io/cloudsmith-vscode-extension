const WEB_APP_BASE_URL = "https://app.cloudsmith.com";

function buildRepositoryUrl(workspace, repo) {
  if (!workspace || !repo) {
    return null;
  }

  return `${WEB_APP_BASE_URL}/${workspace}/${repo}`;
}

function buildPackageUrl(workspace, repo, format, name, version, identifier) {
  if (!workspace || !repo || !format || !name || !version || !identifier) {
    return null;
  }

  const packageName = String(name).replaceAll("/", "_");
  return `${WEB_APP_BASE_URL}/${workspace}/${repo}/${format}/${packageName}/${version}/${identifier}`;
}

function buildPackageGroupUrl(workspace, repo, name) {
  const repositoryUrl = buildRepositoryUrl(workspace, repo);
  if (!repositoryUrl || !name) {
    return null;
  }

  const encodedName = String(name).replaceAll("/", "%2F").replaceAll(":", "%3A");
  return `${repositoryUrl}?page=1&query=name:${encodedName}&sort=name`;
}

module.exports = {
  WEB_APP_BASE_URL,
  buildRepositoryUrl,
  buildPackageUrl,
  buildPackageGroupUrl,
};
