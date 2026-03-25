# Cloudsmith API Reference V2 - Vulnerabilities, Licenses, Dependencies

Supplements [API_REFERENCE.md](./API_REFERENCE.md) with endpoints needed for Phases 5-8.

## Base URL

```
https://api.cloudsmith.io/v1/
```

## Vulnerability Endpoints

### List Vulnerability Scan Results for a Package

```
GET /v1/vulnerabilities/{owner}/{repo}/{package}/
```

The `{package}` parameter is the package's `slug_perm` identifier.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number |
| `page_size` | integer | Results per page |

**Response:** Array of scan result objects. Each scan contains a list of vulnerabilities. Key fields:

```json
{
  "identifier": "scan-abc123",
  "scan_id": 42,
  "created_at": "2025-09-01T12:00:00Z",
  "package": {
    "name": "flask",
    "version": "2.3.0",
    "slug_perm": "abcdef123456"
  },
  "max_severity": "Critical",
  "num_vulnerabilities": 3,
  "vulnerabilities": [
    {
      "name": "CVE-2024-1234",
      "severity": "Critical",
      "description": "Remote code execution via crafted request...",
      "CVSS": {
        "V3Score": 9.8,
        "V3Vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
      },
      "epss": {
        "score": 0.94,
        "percentile": 0.99
      },
      "Status": "fixed",
      "FixedVersion": "2.3.3",
      "PublishedDate": "2024-06-15T00:00:00Z",
      "VulnerabilityID": "CVE-2024-1234",
      "InstalledVersion": "2.3.0",
      "PkgName": "flask"
    }
  ]
}
```

**Key vulnerability fields for the extension:**

| Field | Purpose |
|-------|---------|
| `VulnerabilityID` | CVE identifier (e.g., CVE-2024-1234) |
| `severity` | Human-readable severity: Critical, High, Medium, Low |
| `CVSS.V3Score` | Numeric CVSS v3 score (0.0-10.0) |
| `epss.score` | EPSS probability of exploitation (0.0-1.0) |
| `epss.percentile` | EPSS percentile ranking (0.0-1.0) |
| `Status` | "fixed" or "affected" |
| `FixedVersion` | Version that patches this CVE (when Status is "fixed") |
| `InstalledVersion` | The version currently in the package |
| `PublishedDate` | When the CVE was published |
| `description` | One-line summary of the vulnerability |

### Get a Single Scan Result

```
GET /v1/vulnerabilities/{owner}/{repo}/{package}/{identifier}/
```

Returns full detail for a specific scan result.

### Trigger a Rescan

```
POST /v1/packages/{owner}/{repo}/{identifier}/scan/
```

Schedules a package for re-scanning. No request body needed. Returns 202 Accepted.

## OSV Vulnerability Endpoint

### List OSV Vulnerabilities for a Package

```
GET /v1/packages/{owner}/{repo}/{identifier}/vulnerabilities/osv/
```

Returns OSV-format vulnerability data. Includes additional fields:

```json
{
  "id": "GHSA-xxxx-yyyy",
  "aliases": ["CVE-2024-1234"],
  "summary": "One-line summary",
  "severity": [
    {
      "type": "CVSS_V3",
      "score": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "base_score": 9.8,
      "severity_label": "Critical",
      "parsed_components": { ... }
    }
  ],
  "affected": [
    {
      "ranges": [
        {
          "type": "ECOSYSTEM",
          "events": [
            { "introduced": "0" },
            { "fixed": "2.3.3" }
          ]
        }
      ]
    }
  ],
  "references": [
    { "type": "ADVISORY", "url": "https://..." },
    { "type": "FIX", "url": "https://..." }
  ]
}
```

## Package Detail Fields (License and Dependencies)

### Get Single Package (full detail)

```
GET /v1/packages/{owner}/{repo}/{identifier}/
```

The full package detail response includes fields not present in the list endpoint:

```json
{
  "name": "flask",
  "version": "3.0.0",
  "license": "BSD-3-Clause",
  "license_url": "https://opensource.org/licenses/BSD-3-Clause",
  "description": "A simple framework for building complex web applications.",
  "dependencies_url": "https://api.cloudsmith.io/v1/packages/{owner}/{repo}/{identifier}/dependencies/",
  "vulnerability_scan_results_url": "https://api.cloudsmith.io/v1/vulnerabilities/{owner}/{repo}/{identifier}/",
  "num_vulnerabilities": 3,
  "max_severity": "Critical",
  "files": [
    {
      "filename": "flask-3.0.0.tar.gz",
      "cdn_url": "https://dl.cloudsmith.io/...",
      "size": 234567,
      "tag": null
    }
  ],
  "format_url": "https://pypi.cloudsmith.io/{owner}/{repo}/simple/",
  "repository_url": "https://api.cloudsmith.io/v1/repos/{owner}/{repo}/",
  "cdn_url": "https://dl.cloudsmith.io/basic/{owner}/{repo}/python/...",
  "self_url": "https://api.cloudsmith.io/v1/packages/{owner}/{repo}/{identifier}/"
}
```

**Key fields for Phases 5-8:**

| Field | Phase | Purpose |
|-------|-------|---------|
| `license` | 8 | SPDX license identifier |
| `license_url` | 8 | Link to license text |
| `num_vulnerabilities` | 5 | Count of known vulns |
| `max_severity` | 5 | Highest severity level |
| `vulnerability_scan_results_url` | 5 | Direct URL to vuln scan results |
| `dependencies_url` | 6 | Direct URL to dependencies list |
| `format_url` | 7 | Registry URL for install commands |
| `cdn_url` | 7 | Direct download URL |

### List Dependencies for a Package

```
GET /v1/packages/{owner}/{repo}/{identifier}/dependencies/
```

Returns transitive dependency tree where supported by the package format.

**Response:**

```json
{
  "dependencies": [
    {
      "name": "werkzeug",
      "version": ">=3.0.0",
      "dep_type": "runtime",
      "operator": ">="
    },
    {
      "name": "jinja2",
      "version": ">=3.1.2",
      "dep_type": "runtime",
      "operator": ">="
    }
  ]
}
```

**Format support:** Dependencies are available for Python (pip), npm, Maven, NuGet, Go, Cargo, Composer, Hex, Dart, Ruby, and Conda. Not available for raw, Docker, Debian, RPM, Alpine, or Helm.

## License Policy Endpoints

### List License Policy Violations

```
GET /v1/orgs/{owner}/license-policy/violations/
```

Returns all current license policy violations across the workspace.

### List License Policies

```
GET /v1/orgs/{owner}/license-policy/
```

Returns configured license policies for the workspace.

## Install Command URL Patterns

These are the registry URLs used in native package manager install commands. The format varies by package type:

| Format | Registry URL Pattern | Install Command |
|--------|---------------------|----------------|
| python | `https://dl.cloudsmith.io/basic/{owner}/{repo}/python/simple/` | `pip install {name}=={version} --index-url {url}` |
| npm | `https://npm.cloudsmith.io/{owner}/{repo}/` | `npm install {name}@{version} --registry={url}` |
| maven | `https://dl.cloudsmith.io/basic/{owner}/{repo}/maven/` | pom.xml `<repository>` entry |
| nuget | `https://nuget.cloudsmith.io/{owner}/{repo}/v3/index.json` | `dotnet add package {name} --version {version} --source {url}` |
| docker | `docker.cloudsmith.io/{owner}/{repo}/` | `docker pull {url}{name}:{version}` |
| helm | `https://dl.cloudsmith.io/basic/{owner}/{repo}/helm/charts/` | `helm install {name} --repo {url} --version {version}` |
| cargo | `https://cargo.cloudsmith.io/{owner}/{repo}/` | `cargo add {name}@{version} --registry {url}` |
| go | `https://go.cloudsmith.io/basic/{owner}/{repo}/` | `GONOSUMCHECK={name} GOFLAGS=-insecure go get {name}@{version}` |
| ruby | `https://dl.cloudsmith.io/basic/{owner}/{repo}/ruby/` | `gem install {name} -v {version} --source {url}` |
| composer | `https://composer.cloudsmith.io/{owner}/{repo}/` | `composer require {name}:{version}` (with repo in composer.json) |
| conda | `https://conda.cloudsmith.io/{owner}/{repo}/` | `conda install -c {url} {name}={version}` |
| terraform | `https://terraform.cloudsmith.io/{owner}/{repo}/` | Provider source block |
| debian | `https://dl.cloudsmith.io/basic/{owner}/{repo}/deb/{distro}` | `apt-get install {name}={version}` (with repo in sources.list) |
| rpm | `https://dl.cloudsmith.io/basic/{owner}/{repo}/rpm/{distro}` | `yum install {name}-{version}` (with repo in yum.repos.d) |
| alpine | `https://dl.cloudsmith.io/basic/{owner}/{repo}/alpine/` | `apk add {name}={version}` (with repo in repositories) |
| swift | `https://swift.cloudsmith.io/{owner}/{repo}/` | Package.swift dependency entry |
| dart | `https://dart.cloudsmith.io/basic/{owner}/{repo}/pub/` | `dart pub add {name}:{version}` (with hosted URL) |

**Note on authentication:** For private repos, the `basic` segment in URLs can be replaced with an entitlement token: `https://dl.cloudsmith.io/{token}/{owner}/{repo}/...`. The extension should generate commands using the `basic` pattern and note that authentication may be required, since embedding tokens in copy-paste commands is a security concern.

## Searchable License Field

The packages list endpoint supports license searching:

```
GET /v1/packages/{owner}/{repo}/?query=license:MIT
GET /v1/packages/{owner}/{repo}/?query=license:AGPL
```

This enables the extension to filter packages by license type without fetching individual package details.
