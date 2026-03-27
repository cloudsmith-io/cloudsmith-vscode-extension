// Transitive dependency resolver — shells out to package manager CLIs
// to resolve the full dependency tree including indirect dependencies.
//
// This is opt-in via the cloudsmith-vsc.resolveTransitiveDependencies setting.
// Falls back to manifest parsing if the CLI is unavailable or fails.

const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT_MS = 30000; // 30 seconds

class TransitiveResolver {
  /**
   * Resolve full dependency tree for a given format.
   * Returns array of { name, version, devDependency, format, isDirect } or null if unsupported.
   *
   * @param   {string} projectPath  Path to the project root (workspace folder).
   * @param   {string} format       Package format (npm, python, maven, go, cargo).
   * @returns {Promise<Array|null>} Array of deps, or null if format is unsupported.
   */
  static async resolve(projectPath, format) {
    switch (format) {
      case "npm":
        return TransitiveResolver._resolveNpm(projectPath);
      case "python":
        return TransitiveResolver._resolvePython(projectPath);
      case "maven":
        return TransitiveResolver._resolveMaven(projectPath);
      case "go":
        return TransitiveResolver._resolveGo(projectPath);
      case "cargo":
        return TransitiveResolver._resolveCargo(projectPath);
      default:
        return null; // Unsupported, fall back to manifest parse
    }
  }

  /**
   * npm: Run `npm list --json --all` and parse the dependency tree.
   */
  static async _resolveNpm(projectPath) {
    try {
      const { stdout } = await execFileAsync(
        "npm",
        ["list", "--json", "--all", "--prefix", projectPath],
        { timeout: EXEC_TIMEOUT_MS, cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
      );

      const tree = JSON.parse(stdout);
      const deps = [];
      const directNames = new Set();

      // Collect direct dependency names
      if (tree.dependencies) {
        for (const name of Object.keys(tree.dependencies)) {
          directNames.add(name);
        }
      }

      // Recursively walk the tree
      TransitiveResolver._walkNpmTree(tree.dependencies || {}, deps, directNames, "npm");
      return deps;
    } catch (e) {
      throw TransitiveResolver._wrapError(e, "npm",
        "Ensure npm is installed and run 'npm install' first.");
    }
  }

  /**
   * Recursively walk npm dependency tree.
   */
  static _walkNpmTree(dependencies, result, directNames, format, visited) {
    if (!visited) {
      visited = new Set();
    }

    for (const [name, info] of Object.entries(dependencies)) {
      const visitKey = `${name}@${info.version}`;
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);

      result.push({
        name: name,
        version: info.version || "",
        devDependency: false,
        format: format,
        isDirect: directNames.has(name),
      });

      // Recurse into nested dependencies
      if (info.dependencies) {
        TransitiveResolver._walkNpmTree(info.dependencies, result, directNames, format, visited);
      }
    }
  }

  /**
   * Python: Run `pip list --format=json` to get all installed packages.
   * Cross-reference with known direct deps later.
   */
  static async _resolvePython(projectPath) {
    try {
      const { stdout } = await execFileAsync(
        "pip",
        ["list", "--format=json"],
        { timeout: EXEC_TIMEOUT_MS, cwd: projectPath }
      );

      const packages = JSON.parse(stdout);
      return packages.map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        devDependency: false,
        format: "python",
        isDirect: false, // Will be cross-referenced with requirements.txt later
      }));
    } catch (e) {
      throw TransitiveResolver._wrapError(e, "python (pip)",
        "Ensure pip is installed and accessible in PATH.");
    }
  }

  /**
   * Maven: Run `mvn dependency:tree` and parse the text output.
   */
  static async _resolveMaven(projectPath) {
    try {
      const { stdout } = await execFileAsync(
        "mvn",
        ["dependency:tree", "-DoutputType=text", "-f", path.join(projectPath, "pom.xml")],
        { timeout: EXEC_TIMEOUT_MS, cwd: projectPath, maxBuffer: 5 * 1024 * 1024 }
      );

      const deps = [];
      const lines = stdout.split("\n");
      // Maven tree lines look like: [INFO]    +- group:artifact:type:version:scope
      const depPattern = /\[INFO\]\s*[+|\\-]+\s+(\S+):(\S+):(\S+):(\S+):(\S+)/;

      for (const line of lines) {
        const match = line.match(depPattern);
        if (match) {
          const groupId = match[1];
          const artifactId = match[2];
          // match[3] is type (jar, pom, etc.)
          const version = match[4];
          const scope = match[5];

          // Direct deps have minimal indentation (one level)
          const indentMatch = line.match(/\[INFO\](\s*)/);
          const indent = indentMatch ? indentMatch[1].length : 0;

          deps.push({
            name: `${groupId}:${artifactId}`,
            version: version,
            devDependency: scope === "test",
            format: "maven",
            isDirect: indent <= 4,
          });
        }
      }
      return deps;
    } catch (e) {
      throw TransitiveResolver._wrapError(e, "maven (mvn)",
        "Ensure Maven is installed and pom.xml is valid.");
    }
  }

  /**
   * Go: Run `go list -m -json all` to list all modules.
   */
  static async _resolveGo(projectPath) {
    try {
      const { stdout } = await execFileAsync(
        "go",
        ["list", "-m", "-json", "all"],
        { timeout: EXEC_TIMEOUT_MS, cwd: projectPath, maxBuffer: 5 * 1024 * 1024 }
      );

      // Output is concatenated JSON objects (not an array)
      const deps = [];
      const objects = stdout.split("\n}\n");

      for (const obj of objects) {
        const trimmed = obj.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const parsed = JSON.parse(trimmed.endsWith("}") ? trimmed : trimmed + "}");
          if (parsed.Main) {
            continue; // Skip the main module itself
          }
          deps.push({
            name: parsed.Path,
            version: (parsed.Version || "").replace(/^v/, ""),
            devDependency: parsed.Indirect || false,
            format: "go",
            isDirect: !parsed.Indirect,
          });
        } catch (e2) { // eslint-disable-line no-unused-vars
          // Skip malformed JSON object
        }
      }
      return deps;
    } catch (e) {
      throw TransitiveResolver._wrapError(e, "go",
        "Ensure Go is installed and run 'go mod download' first.");
    }
  }

  /**
   * Cargo: Run `cargo metadata --format-version 1` and parse the JSON output.
   */
  static async _resolveCargo(projectPath) {
    try {
      const { stdout } = await execFileAsync(
        "cargo",
        ["metadata", "--format-version", "1", "--manifest-path", path.join(projectPath, "Cargo.toml")],
        { timeout: EXEC_TIMEOUT_MS, cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
      );

      const metadata = JSON.parse(stdout);
      const deps = [];

      // Get the root package ID to identify direct deps
      const rootId = metadata.resolve && metadata.resolve.root;
      const directDepIds = new Set();

      if (metadata.resolve && metadata.resolve.nodes) {
        const rootNode = metadata.resolve.nodes.find(n => n.id === rootId);
        if (rootNode && rootNode.deps) {
          for (const d of rootNode.deps) {
            directDepIds.add(d.pkg);
          }
        }
      }

      // Walk all packages except the root
      for (const pkg of (metadata.packages || [])) {
        if (pkg.id === rootId) {
          continue;
        }
        deps.push({
          name: pkg.name,
          version: pkg.version,
          devDependency: false,
          format: "cargo",
          isDirect: directDepIds.has(pkg.id),
        });
      }
      return deps;
    } catch (e) {
      throw TransitiveResolver._wrapError(e, "cargo",
        "Ensure Cargo is installed and Cargo.toml is valid.");
    }
  }

  /**
   * Wrap an exec error with a user-friendly message.
   */
  static _wrapError(error, toolName, suggestion) {
    if (error.code === "ENOENT") {
      return new Error(
        `${toolName} CLI not found. ${suggestion}`
      );
    }
    if (error.killed || (error.signal && error.signal === "SIGTERM")) {
      return new Error(
        `${toolName} command timed out after ${EXEC_TIMEOUT_MS / 1000} seconds. ` +
        "Try running the command manually to check for issues."
      );
    }
    return new Error(
      `${toolName} resolution failed: ${error.message || error}. ${suggestion}`
    );
  }
}

module.exports = { TransitiveResolver };
