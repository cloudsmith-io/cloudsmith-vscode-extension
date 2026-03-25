// Install command builder - generates format-native install commands
// with Cloudsmith registry URLs pre-filled.

class InstallCommandBuilder {
  /**
   * Escape a string for safe single-quoted shell usage.
   */
  static shellEscape(str) {
    const value = String(str);
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  /**
   * Build a copy-paste-ready install command for a package.
   *
   * @param   {string} format    Package format (e.g., 'python', 'npm', 'maven').
   * @param   {string} name      Package name.
   * @param   {string} version   Package version.
   * @param   {string} workspace Cloudsmith workspace/owner slug.
   * @param   {string} repo      Cloudsmith repository slug.
   * @param   {object} [opts]    Extra package fields for format-specific handling.
   * @param   {string} [opts.checksumSha256] Docker image digest for pinned pulls.
   * @param   {string} [opts.cdnUrl]         Direct CDN download URL (raw/generic).
   * @param   {string} [opts.filename]       Original filename (raw/generic).
   * @returns {{ command: string, note: string|null, alternatives?: Array<{label: string, command: string}> }}
   */
  static build(format, name, version, workspace, repo, opts) {
    const options = opts || {};
    const safeName = InstallCommandBuilder.shellEscape(name);
    const safeVersion = InstallCommandBuilder.shellEscape(version);
    const commands = {
      python: {
        command: `# Verify package details before running\npip install ${safeName}==${safeVersion} --index-url https://dl.cloudsmith.io/basic/${workspace}/${repo}/python/simple/`,
        note: 'For private repos, replace "basic" with your entitlement token.',
      },
      npm: {
        command: `# Verify package details before running\nnpm install ${safeName}@${safeVersion} --registry=https://npm.cloudsmith.io/${workspace}/${repo}/`,
        note: "Run `npm login --registry=https://npm.cloudsmith.io/" + workspace + "/" + repo + "/` first for private repos.",
      },
      maven: {
        command: InstallCommandBuilder._buildMaven(name, version, workspace, repo),
        note: 'For private repos, replace "basic" with your entitlement token in the repository URL.',
      },
      nuget: {
        command: `# Verify package details before running\ndotnet add package ${safeName} --version ${safeVersion} --source https://nuget.cloudsmith.io/${workspace}/${repo}/v3/index.json`,
        note: "For private repos, configure NuGet source credentials.",
      },
      helm: {
        command: `# Verify package details before running\nhelm install ${safeName} --repo https://dl.cloudsmith.io/basic/${workspace}/${repo}/helm/charts/ --version ${safeVersion}`,
        note: 'For private repos, replace "basic" with your entitlement token.',
      },
      cargo: {
        command: `# Verify package details before running\ncargo add ${safeName}@${safeVersion}`,
        note: `Add registry to .cargo/config.toml:\n[registries.cloudsmith]\nindex = "sparse+https://cargo.cloudsmith.io/${workspace}/${repo}/"`,
      },
      go: {
        command: `# Verify package details before running\nGONOSUMCHECK=${safeName} go get ${safeName}@v${safeVersion}`,
        note: `Set GOPROXY=https://go.cloudsmith.io/basic/${workspace}/${repo}/,direct`,
      },
      ruby: {
        command: `# Verify package details before running\ngem install ${safeName} -v ${safeVersion} --source https://dl.cloudsmith.io/basic/${workspace}/${repo}/ruby/`,
        note: 'For private repos, replace "basic" with your entitlement token.',
      },
      conda: {
        command: `# Verify package details before running\nconda install -c https://conda.cloudsmith.io/${workspace}/${repo}/ ${safeName}=${safeVersion}`,
        note: null,
      },
      composer: {
        command: `# Verify package details before running\ncomposer require ${safeName}:${safeVersion}`,
        note: `Add repository to composer.json:\n{"type": "composer", "url": "https://composer.cloudsmith.io/${workspace}/${repo}/"}`,
      },
      dart: {
        command: `# Verify package details before running\ndart pub add ${safeName}:${safeVersion}`,
        note: `Add hosted URL to pubspec.yaml:\n  ${name}:\n    hosted: https://dart.cloudsmith.io/basic/${workspace}/${repo}/pub/\n    version: ${version}`,
      },
    };

    // Formats with dedicated handlers
    if (format === "docker") {
      return InstallCommandBuilder._buildDocker(name, version, workspace, repo, options);
    }
    if (format === "rpm") {
      return InstallCommandBuilder._buildRpm(name, version, workspace, repo);
    }
    if (format === "raw" || format === "generic") {
      return InstallCommandBuilder._buildRaw(name, version, workspace, repo, options);
    }

    const entry = commands[format];
    if (!entry) {
      return {
        command: `# Verify package details before running\n# No install command template for format: ${format}`,
        note: `Visit https://app.cloudsmith.com/${workspace}/${repo} for setup instructions.`,
      };
    }
    return entry;
  }

  /**
   * Build Docker pull command — tag-first with optional digest alternative.
   */
  static _buildDocker(name, version, workspace, repo, opts) {
    const registry = `docker.cloudsmith.io/${workspace}/${repo}`;
    const tag = version || "latest";
    const result = {
      command: `# Verify package details before running\ndocker pull ${registry}/${name}:${tag}`,
      note: "Run `docker login docker.cloudsmith.io` first for private repos.",
    };

    if (opts.checksumSha256) {
      result.alternatives = [{
        label: "Pull by digest (pinned)",
        command: `# Verify package details before running\ndocker pull ${registry}/${name}@sha256:${opts.checksumSha256}`,
      }];
    }

    return result;
  }

  /**
   * Build RPM install command — dnf primary, yum alternative.
   */
  static _buildRpm(name, version, workspace, repo) {
    const safeName = InstallCommandBuilder.shellEscape(name);
    const safeVersion = InstallCommandBuilder.shellEscape(version);
    return {
      command: `# Verify package details before running\ndnf install ${safeName}-${safeVersion}`,
      note: `Requires Cloudsmith repo configured in /etc/yum.repos.d/.\nRepo URL: https://dl.cloudsmith.io/basic/${workspace}/${repo}/rpm/`,
      alternatives: [{
        label: "Install via yum",
        command: `# Verify package details before running\nyum install ${safeName}-${safeVersion}`,
      }],
    };
  }

  /**
   * Build Raw/Generic download command — curl primary, wget alternative.
   */
  static _buildRaw(name, version, workspace, repo, opts) {
    const filename = opts.filename || `${name}-${version}`;
    const cdnUrl = opts.cdnUrl ||
      `https://dl.cloudsmith.io/basic/${workspace}/${repo}/raw/names/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}/${encodeURIComponent(filename)}`;

    return {
      command: `# Verify package details before running\ncurl -L -O "${cdnUrl}"`,
      note: 'For private repos, replace "basic" with your entitlement token or use authentication headers.',
      alternatives: [{
        label: "Download via wget",
        command: `# Verify package details before running\nwget "${cdnUrl}"`,
      }],
    };
  }

  /**
   * Build a Maven pom.xml snippet with repository and dependency blocks.
   * Splits name on : to get groupId and artifactId.
   */
  static _buildMaven(name, version, workspace, repo) {
    let groupId;
    let artifactId;
    if (name.includes(":")) {
      const parts = name.split(":");
      groupId = parts[0];
      artifactId = parts[1];
    } else {
      groupId = name;
      artifactId = name;
    }

    const escapeXml = (value) => String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    return [
      "<!-- Add to pom.xml repositories -->",
      "<repository>",
      `  <id>cloudsmith-${escapeXml(repo)}</id>`,
      `  <url>https://dl.cloudsmith.io/basic/${escapeXml(workspace)}/${escapeXml(repo)}/maven/</url>`,
      "</repository>",
      "",
      "<!-- Add to dependencies -->",
      "<dependency>",
      `  <groupId>${escapeXml(groupId)}</groupId>`,
      `  <artifactId>${escapeXml(artifactId)}</artifactId>`,
      `  <version>${escapeXml(version)}</version>`,
      "</dependency>",
    ].join("\n");
  }
}

module.exports = { InstallCommandBuilder };
