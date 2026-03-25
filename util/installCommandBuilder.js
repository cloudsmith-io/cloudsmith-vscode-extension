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
   * @returns {{ command: string, note: string|null }}
   */
  static build(format, name, version, workspace, repo) {
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
      docker: {
        command: `# Verify package details before running\ndocker pull docker.cloudsmith.io/${workspace}/${repo}/${safeName}:${safeVersion}`,
        note: "Run `docker login docker.cloudsmith.io` first for private repos.",
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
