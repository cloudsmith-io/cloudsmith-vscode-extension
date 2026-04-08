// Dependency Health tree data provider.
// Reads project manifests, cross-references dependencies against Cloudsmith,
// and surfaces a health dashboard in the sidebar.

const vscode = require("vscode");
const path = require("path");
const { CloudsmithAPI } = require("../util/cloudsmithAPI");
const { ManifestParser } = require("../util/manifestParser");
const { TransitiveResolver } = require("../util/transitiveResolver");
const DependencyHealthNode = require("../models/dependencyHealthNode");
const InfoNode = require("../models/infoNode");

const BATCH_SIZE = 5;
const DEFAULT_MAX_DEPENDENCIES_TO_SCAN = 200;

class DependencyHealthProvider {
  constructor(context, diagnosticsPublisher) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.dependencies = [];
    this.lastWorkspace = null;
    this.lastRepo = null;
    this._scanning = false;
    this._statusMessage = null;
    this._diagnosticsPublisher = diagnosticsPublisher || null;
    this._lastManifests = [];
    this._projectFolderPath = null; // manually selected folder, persists across scans
    this._hasScannedOnce = false;
    // Auto-refresh when connection status changes in secrets store.
    // This ensures the welcome/connected state updates without external refresh calls.
    this.context.secrets.onDidChange(e => {
      if (e.key === "cloudsmith-vsc.isConnected") {
        this.refresh();
      }
    });
  }

  /**
   * Get the project folder to scan. Returns a path string.
   * Priority: manually selected folder > first VS Code workspace folder > null.
   */
  getProjectFolder() {
    if (this._projectFolderPath) {
      return this._projectFolderPath;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return null;
  }

  /**
   * Set a manually picked project folder.
   */
  setProjectFolder(folderPath) {
    this._projectFolderPath = folderPath;
  }

  /**
   * Prompt the user to pick a folder when no workspace is open.
   * Returns the selected path or null if cancelled.
   */
  async promptForFolder() {
    const choice = await vscode.window.showQuickPick(
      [
        { label: "$(folder-opened) Select a folder to scan", description: "Browse for a project folder", _action: "pick" },
        { label: "$(folder) Open a project folder", description: "Open a folder in VS Code", _action: "open" },
      ],
      { placeHolder: "No workspace folder is open. Select a project folder to scan." }
    );

    if (!choice) {
      return null;
    }

    if (choice._action === "open") {
      await vscode.commands.executeCommand("vscode.openFolder");
      return null; // VS Code will reload, scan can happen after
    }

    // Folder picker dialog
    const selected = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Scan for dependencies",
    });

    if (!selected || selected.length === 0) {
      return null;
    }

    const folderPath = selected[0].fsPath;
    this._projectFolderPath = folderPath;
    return folderPath;
  }

  /**
   * Scan project manifests and cross-reference against Cloudsmith.
   *
   * @param   {string} cloudsmithWorkspace  Workspace/owner slug.
   * @param   {string|null} cloudsmithRepo  Optional repo slug for scoped scan.
   * @param   {string|null} projectFolder   Optional project folder path override.
   */
  async scan(cloudsmithWorkspace, cloudsmithRepo, projectFolder) {
    if (this._scanning) {
      vscode.window.showWarningMessage("A dependency scan is already in progress.");
      return;
    }

    // Resolve project folder
    let folderPath = projectFolder || this.getProjectFolder();
    if (!folderPath) {
      folderPath = await this.promptForFolder();
      if (!folderPath) {
        return; // User cancelled
      }
    }

    this._scanning = true;
    this._hasScannedOnce = true;
    this.lastWorkspace = cloudsmithWorkspace;
    this.lastRepo = cloudsmithRepo;
    this.dependencies = [];
    this._statusMessage = "Scanning project manifests...";
    this.refresh();

    const cancellationSource = new vscode.CancellationTokenSource();

    try {
      const scanResult = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Scanning dependency health",
          cancellable: true,
        },
        async (progress, token) => {
          const tokenSubscription = token.onCancellationRequested(() => {
            cancellationSource.cancel();
          });

          try {
            return await this._performScan(
              cloudsmithWorkspace,
              cloudsmithRepo,
              folderPath,
              progress,
              cancellationSource.token
            );
          } finally {
            tokenSubscription.dispose();
          }
        }
      );

      if (scanResult && scanResult.canceled) {
        this._statusMessage = null;
        if (this._diagnosticsPublisher) {
          this._diagnosticsPublisher.clear();
        }
        vscode.window.showInformationMessage("Dependency scan canceled.");
      }
    } catch (e) {
      const reason = e && e.message
        ? e.message
        : "Check the Cloudsmith connection.";
      this.dependencies = [];
      if (this._diagnosticsPublisher) {
        this._diagnosticsPublisher.clear();
      }
      this._statusMessage = null;
      this._failureMessage = `Scan failed. ${reason}`;
      vscode.window.showErrorMessage(this._failureMessage);
    } finally {
      cancellationSource.dispose();
      this._scanning = false;
      this.refresh();
    }
  }

  _getMaxDependenciesToScan() {
    const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
    const configuredValue = Number(config.get("maxDependenciesToScan"));
    if (!Number.isFinite(configuredValue) || configuredValue < 1) {
      return DEFAULT_MAX_DEPENDENCIES_TO_SCAN;
    }
    return Math.floor(configuredValue);
  }

  async _waitForCancellationOrTimeout(token, ms) {
    if (token && token.isCancellationRequested) {
      return true;
    }

    return new Promise(resolve => {
      let subscription = null;
      const timer = setTimeout(() => {
        if (subscription) {
          subscription.dispose();
        }
        resolve(false);
      }, ms);

      if (token && typeof token.onCancellationRequested === "function") {
        subscription = token.onCancellationRequested(() => {
          clearTimeout(timer);
          if (subscription) {
            subscription.dispose();
          }
          resolve(true);
        });
      }
    });
  }

  _isExactDependencyMatch(pkg, expected) {
    if (!pkg || typeof pkg !== "object" || !expected) {
      return false;
    }

    if (String(pkg.name || "") !== String(expected.name || "")) {
      return false;
    }
    if (String(pkg.format || "") !== String(expected.format || "")) {
      return false;
    }
    // When the declared version is empty/null/undefined, treat as a name-only
    // match so we select the newest package from the query results.
    if (expected.version) {
      if (String(pkg.version || "") !== String(expected.version)) {
        return false;
      }
    }
    return true;
  }

  _exactDependencyMatch(pkg, deps) {
    if (!pkg || !Array.isArray(deps)) {
      return null;
    }

    return deps.find(dep => this._isExactDependencyMatch(pkg, dep)) || null;
  }

  async _performScan(cloudsmithWorkspace, cloudsmithRepo, folderPath, progress, token) {
    progress.report({ message: "Detecting manifests", increment: 10 });

    let allDeps = [];
    this._lastManifests = [];

    // Scan the single resolved folder path (not workspace folders)
    if (token.isCancellationRequested) {
      return { canceled: true };
    }

    const manifests = await ManifestParser.detectManifests(folderPath);
    if (token.isCancellationRequested) {
      return { canceled: true };
    }

    this._lastManifests = manifests;

    if (manifests.length === 0) {
      // No manifests found — set a descriptive message
      const folderName = path.basename(folderPath);
      this.dependencies = [];
      this._statusMessage = null;
      this._noManifestsFolder = folderName;
      return { canceled: false };
    }

    for (const manifest of manifests) {
      if (token.isCancellationRequested) {
        return { canceled: true };
      }

      const parsed = await ManifestParser.parseManifest(manifest);
      allDeps = allDeps.concat(parsed);
    }

    if (allDeps.length === 0) {
      this._statusMessage = null;
      this._noManifestsFolder = path.basename(folderPath);
      return { canceled: false };
    }

    // Clear the no-manifests flag since we found deps
    this._noManifestsFolder = null;

    progress.report({ message: "Resolving manifests", increment: 15 });

    const resolveConfig = vscode.workspace.getConfiguration("cloudsmith-vsc");
    if (resolveConfig.get("resolveTransitiveDependencies")) {
      this._statusMessage = "Resolving transitive dependencies via CLI...";
      this.refresh();

      const directNames = new Set(allDeps.map(d => d.name));
      const formatsResolved = new Set();
      const formats = [...new Set(this._lastManifests.map(m => m.format))];

      for (const format of formats) {
        if (token.isCancellationRequested) {
          return { canceled: true };
        }
        if (formatsResolved.has(format)) {
          continue;
        }
        try {
          const transitiveDeps = await TransitiveResolver.resolve(folderPath, format);
          if (token.isCancellationRequested) {
            return { canceled: true };
          }
          if (transitiveDeps && transitiveDeps.length > 0) {
            for (const dep of transitiveDeps) {
              dep.isDirect = directNames.has(dep.name);
            }
            allDeps = allDeps.filter(d => d.format !== format);
            allDeps = allDeps.concat(transitiveDeps);
            formatsResolved.add(format);
          }
        } catch (e) {
          vscode.window.showWarningMessage(
            `Could not resolve transitive dependencies for ${format}. Using direct dependencies only. ${e.message}`
          );
        }
      }
    }

    const seen = new Set();
    const uniqueDeps = [];
    for (const dep of allDeps) {
      const key = `${dep.format}:${dep.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueDeps.push(dep);
      }
    }

    const maxDependenciesToScan = this._getMaxDependenciesToScan();
    const depsToScan = uniqueDeps.slice(0, maxDependenciesToScan);
    if (uniqueDeps.length > depsToScan.length) {
      vscode.window.showWarningMessage(
        `Dependency scan truncated to ${depsToScan.length} dependencies out of ${uniqueDeps.length}. Increase cloudsmith-vsc.maxDependenciesToScan to scan more.`
      );
    }

    this._statusMessage = `Found ${uniqueDeps.length} dependencies. Checking ${depsToScan.length} against Cloudsmith...`;
    this.refresh();

    progress.report({ message: "Checking Cloudsmith", increment: 20 });

    const byFormat = {};
    for (const dep of depsToScan) {
      if (!byFormat[dep.format]) {
        byFormat[dep.format] = [];
      }
      byFormat[dep.format].push(dep);
    }

    const cloudsmithAPI = new CloudsmithAPI(this.context);
    const allResults = new Map();

    for (const [format, deps] of Object.entries(byFormat)) {
      for (let i = 0; i < deps.length; i += BATCH_SIZE) {
        if (token.isCancellationRequested) {
          return { canceled: true };
        }

        const batch = deps.slice(i, i + BATCH_SIZE);
        const nameTerms = batch.map(d => `name:^${d.name}$`).join(" OR ");
        const query = `(${nameTerms}) AND format:${format}`;
        const baseEndpoint = cloudsmithRepo
          ? `packages/${cloudsmithWorkspace}/${cloudsmithRepo}/`
          : `packages/${cloudsmithWorkspace}/`;
        const endpoint = `${baseEndpoint}?query=${encodeURIComponent(query)}&sort=-version&page_size=${BATCH_SIZE * 3}`;

        const result = await cloudsmithAPI.get(endpoint);

        if (token.isCancellationRequested) {
          return { canceled: true };
        }

        if (typeof result === "string" && result.includes("429")) {
          this._statusMessage = "Rate limited. Pausing scan for 30 seconds...";
          this.refresh();
          const cancelledDuringBackoff = await this._waitForCancellationOrTimeout(token, 30000);
          if (cancelledDuringBackoff) {
            return { canceled: true };
          }

          const retry = await cloudsmithAPI.get(endpoint);
          if (token.isCancellationRequested) {
            return { canceled: true };
          }
          if (typeof retry === "string") {
            throw new Error(
              `Dependency lookup failed after retry for ${format}: ${retry}`
            );
          }
          if (Array.isArray(retry)) {
            for (const pkg of retry) {
              const matchingDep = this._exactDependencyMatch(pkg, batch);
              if (matchingDep) {
                const mapKey = `${matchingDep.format}:${matchingDep.name}`;
                if (!allResults.has(mapKey) || pkg.version > allResults.get(mapKey).version) {
                  allResults.set(mapKey, pkg);
                }
              }
            }
          }
        } else if (typeof result === "string") {
          throw new Error(`Dependency lookup failed for ${format}: ${result}`);
        } else if (Array.isArray(result)) {
          for (const pkg of result) {
            const matchingDep = this._exactDependencyMatch(pkg, batch);
            if (matchingDep) {
              const mapKey = `${matchingDep.format}:${matchingDep.name}`;
              if (!allResults.has(mapKey) || pkg.version > allResults.get(mapKey).version) {
                allResults.set(mapKey, pkg);
              }
            }
          }
        }

        for (const dep of batch) {
          const match = allResults.get(`${dep.format}:${dep.name}`) || null;
          this.dependencies.push(
            new DependencyHealthNode(dep, match, this.context)
          );
        }

        this.dependencies.sort((a, b) => a.sortOrder - b.sortOrder);

        this._statusMessage = `Checked ${Math.min(i + BATCH_SIZE, deps.length)} of ${deps.length} ${format} dependencies...`;
        progress.report({ message: `Checked ${Math.min(i + BATCH_SIZE, deps.length)} of ${deps.length} ${format} dependencies...` });
        this.refresh();
      }
    }

    this.dependencies.sort((a, b) => a.sortOrder - b.sortOrder);

    if (this._diagnosticsPublisher) {
      await this._diagnosticsPublisher.publish(this._lastManifests, this.dependencies);
    }

    this._statusMessage = null;
    return { canceled: false };
  }

  /** Re-run the last scan with same settings. */
  async rescan() {
    if (this.lastWorkspace) {
      await this.scan(this.lastWorkspace, this.lastRepo);
    } else {
      vscode.window.showInformationMessage('No previous scan. Run "Scan dependencies" first.');
    }
  }

  getTreeItem(element) {
    return element.getTreeItem();
  }

  // IMPORTANT: Connection status is checked live from context.secrets every render.
  // Do NOT cache this value or rely on external refresh calls to set a connection flag.
  // This pattern was adopted after three regressions caused by refresh wiring changes.
  async getChildren(element) {
    if (element) {
      return element.getChildren();
    }

    // Show progress message while scanning
    if (this._statusMessage) {
      return [new InfoNode(
        this._statusMessage,
        "",
        this._statusMessage,
        "sync~spin",
        "statusMessage"
      )];
    }

    // Show failure message if last scan failed
    if (this._failureMessage) {
      return [new InfoNode(
        this._failureMessage,
        "",
        this._failureMessage,
        "error",
        "statusMessage"
      )];
    }

    // Show "no manifests found" state
    if (this._noManifestsFolder) {
      return [new InfoNode(
        "No dependency manifests found",
        this._noManifestsFolder,
        "Supported formats: package.json, requirements.txt, pyproject.toml, pom.xml, go.mod, Cargo.toml",
        "warning",
        "infoNode"
      )];
    }

    // Show results if we have them
    if (this.dependencies.length > 0) {
      return this.dependencies;
    }

    // Welcome state — no scan has been run yet
    if (!this._hasScannedOnce) {
      const isConnected = await this.context.secrets.get("cloudsmith-vsc.isConnected");
      if (isConnected !== "true") {
        return [new InfoNode(
          "Connect to Cloudsmith",
          "Use the key icon above to set up a personal or service account API key, CLI import, or SSO.",
          "Set up Cloudsmith authentication to get started.",
          "plug",
          undefined,
          { command: "cloudsmith-vsc.configureCredentials", title: "Set up authentication" }
        )];
      }
      // Connected but no scan run yet
      return [new InfoNode(
        "Scan project dependencies",
        "Select the play button above to start.",
        "Reads local manifest files (package.json, requirements.txt, pyproject.toml, pom.xml, go.mod, Cargo.toml) and checks each dependency against the selected Cloudsmith workspace.",
        "folder",
        "dependencyHealthWelcome"
      )];
    }

    // Scan completed but no dependencies were found in the manifests
    return [new InfoNode(
      "No dependencies found",
      "",
      "The manifest files were parsed but contained no dependency entries.",
      "info",
      "infoNode"
    )];
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}

module.exports = { DependencyHealthProvider };
