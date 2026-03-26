// SSO authentication manager — pragmatic credential setup for SSO-enabled
// Cloudsmith workspaces.
//
// Three approaches, in order of reliability:
//
// A. CLI config import (importFromCLI) — PRIMARY
//    Reads an existing API key from the Cloudsmith CLI's config file
//    (~/.cloudsmith/config.ini). This is the most reliable path for SSO users.
//
// B. Terminal-based SSO (loginViaTerminal)
//    Opens a VS Code integrated terminal and runs `cloudsmith auth -o {workspace}`
//    so the user can complete the interactive SAML + 2FA flow. After the terminal
//    closes, offers to import the resulting credentials.
//
// C. Browser-based SAML redirect (loginViaBrowser) — EXPERIMENTAL
//    Starts a local HTTP server on port 12400, opens the SAML endpoint in the
//    browser, and waits for the redirect. Gated behind the
//    cloudsmith-vsc.experimentalSSOBrowser setting. Uses a one-time callback path
//    to reject unrelated localhost traffic and avoids logging callback payloads.

const crypto = require("crypto");
const vscode = require("vscode");
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const os = require("os");

// The CLI always uses port 12400 for the SAML redirect.
const SAML_CALLBACK_PORT = 12400;
const CALLBACK_SUCCESS_PATH = "/authenticated";

// Known query parameter names that might contain the auth token.
const TOKEN_PARAM_NAMES = ["api_key", "token", "access_token", "key"];
const WORKSPACE_SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

class SSOAuthManager {
  constructor(context) {
    this.context = context;
  }

  // --------------------------------------------------------------------------
  // Approach A: Import credentials from Cloudsmith CLI config (primary)
  // --------------------------------------------------------------------------

  /**
   * Import an API key from the Cloudsmith CLI's config file.
   *
   * The CLI stores credentials in an INI-style config file after
   * `cloudsmith auth` or `cloudsmith auth -o {workspace}` completes.
   *
   * @returns {Promise<boolean>} True if import succeeded, false otherwise.
   */
  async importFromCLI() {
    const configPath = this._findCLIConfigPath();

    if (!configPath) {
      vscode.window.showErrorMessage(
        'Could not find Cloudsmith CLI configuration. Run "cloudsmith auth" in your terminal first.'
      );
      return false;
    }

    let content;
    try {
      content = await fs.promises.readFile(configPath, "utf8");
    } catch (e) {
      console.debug("Could not read Cloudsmith CLI config:", configPath, e);
      vscode.window.showErrorMessage(
        "Could not read Cloudsmith CLI config. Check file permissions."
      );
      return false;
    }

    const apiKey = this._parseAPIKeyFromConfig(content);

    if (!apiKey) {
      vscode.window.showErrorMessage(
        "No API key found in Cloudsmith CLI config. " +
        "Run 'cloudsmith auth -o {workspace}' to authenticate first."
      );
      return false;
    }

    await this.context.secrets.store("cloudsmith-vsc.authToken", apiKey);
    vscode.window.showInformationMessage(
      "Credentials imported from Cloudsmith CLI config. Connected!"
    );
    return true;
  }

  /**
   * Silently check whether CLI credentials exist (for auto-detect on activation).
   * Returns true if a config file with an API key was found, false otherwise.
   * Does NOT import or store anything — call importFromCLI() to do that.
   */
  hasCLICredentials() {
    const configPath = this._findCLIConfigPath();
    if (!configPath) {
      return false;
    }
    try {
      const content = fs.readFileSync(configPath, "utf8");
      return !!this._parseAPIKeyFromConfig(content);
    } catch (e) { // eslint-disable-line no-unused-vars
      return false;
    }
  }

  /**
   * Locate the Cloudsmith CLI config file.
   * Checks platform-specific paths and returns the first one that exists,
   * or null if none are found.
   */
  _findCLIConfigPath() {
    const home = os.homedir();
    const candidates = [];

    // The CLI's primary config location
    candidates.push(path.join(home, ".cloudsmith", "config.ini"));

    // XDG-style (Linux)
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
    candidates.push(path.join(xdgConfig, "cloudsmith", "config.ini"));

    // macOS Application Support
    if (process.platform === "darwin") {
      candidates.push(
        path.join(home, "Library", "Application Support", "cloudsmith", "config.ini")
      );
    }

    // Windows AppData
    if (process.platform === "win32" && process.env.APPDATA) {
      candidates.push(
        path.join(process.env.APPDATA, "cloudsmith", "config.ini")
      );
    }

    for (const candidate of candidates) {
      try {
        fs.accessSync(candidate, fs.constants.R_OK);
        return candidate;
      } catch (e) { // eslint-disable-line no-unused-vars
        // File doesn't exist or isn't readable, try next
      }
    }
    return null;
  }

  /**
   * Parse the API key from a Cloudsmith CLI INI-style config string.
   *
   * Expected format:
   *   [default]
   *   api_key = cs_xxxxxxxxxxxxxxxxxxxx
   *
   * @param   {string} content  Raw config file content.
   * @returns {string|null}     The API key, or null if not found.
   */
  _parseAPIKeyFromConfig(content) {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Match: api_key = value  or  api_key=value
      const match = trimmed.match(/^api_key\s*=\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        if (key) {
          return key;
        }
      }
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Approach B: Terminal-based SSO (opens integrated terminal)
  // --------------------------------------------------------------------------

  /**
   * Open a VS Code integrated terminal and run `cloudsmith auth -o {workspace}`
   * so the user can complete the interactive SAML + 2FA flow. After the terminal
   * is visible, show an info message offering to import credentials once done.
   *
   * @param {string} workspaceSlug  The Cloudsmith workspace/org slug.
   * @returns {Promise<boolean>} True if credentials were imported after the
   *          terminal flow, false otherwise.
   */
  async loginViaTerminal(workspaceSlug) {
    if (!this._isValidWorkspaceSlug(workspaceSlug)) {
      vscode.window.showErrorMessage("Enter a valid Cloudsmith workspace slug.");
      return false;
    }

    // Create and show an integrated terminal
    const terminal = vscode.window.createTerminal("Cloudsmith SSO");
    terminal.show();
    terminal.sendText(`cloudsmith auth -o ${workspaceSlug}`);

    // Listen for the terminal closing so we can auto-prompt import
    const closePromise = new Promise((resolve) => {
      let done = false;
      const disposable = vscode.window.onDidCloseTerminal((closed) => {
        if (!done && closed === terminal) {
          done = true;
          disposable.dispose();
          resolve();
        }
      });

      // Also offer import after a delay in case the user doesn't close the terminal
      setTimeout(() => {
        if (!done) {
          done = true;
          disposable.dispose();
          resolve();
        }
      }, 10000);
    });

    await closePromise;

    // Offer to import credentials
    const choice = await vscode.window.showInformationMessage(
      "SSO authentication complete? Click 'Import' to load your credentials from the CLI config.",
      "Import", "Dismiss"
    );

    if (choice === "Import") {
      return this.importFromCLI();
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // Approach C: Experimental browser-based SAML redirect
  // --------------------------------------------------------------------------

  /**
   * Attempt SSO login via the SAML endpoint with a localhost:12400 redirect.
   *
   * EXPERIMENTAL — gated behind cloudsmith-vsc.experimentalSSOBrowser setting.
   *
   * The Cloudsmith CLI uses this exact flow on port 12400. The SAML endpoint
   * may require prior authentication (JWT), which creates a chicken-and-egg
   * problem for first-time setup. This flow uses a one-time callback path and
   * stores the resulting token without logging callback contents.
   *
   * @param {string} workspaceSlug  The Cloudsmith workspace/org slug.
   * @returns {Promise<boolean>} True if login succeeded, false otherwise.
   */
  async loginViaBrowser(workspaceSlug) {
    if (!this._isValidWorkspaceSlug(workspaceSlug)) {
      vscode.window.showErrorMessage("Enter a valid Cloudsmith workspace slug.");
      return false;
    }

    const callbackId = crypto.randomBytes(16).toString("hex");
    const callbackPath = `/callback/${callbackId}`;

    // Start a local HTTP server on the CLI's fixed port (12400)
    let serverResult;
    try {
      serverResult = await this._startCallbackServer(callbackPath);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Cannot start SSO callback server on port ${SAML_CALLBACK_PORT}. ` +
        `Please free the port and try again. (${err.message})`
      );
      return false;
    }

    const { server } = serverResult;
    const redirectUrl = `http://127.0.0.1:${SAML_CALLBACK_PORT}${callbackPath}`;
    const authUrl =
      `https://api.cloudsmith.io/orgs/${encodeURIComponent(workspaceSlug)}/saml/` +
      `?redirect_url=${encodeURIComponent(redirectUrl)}`;

    // Create a promise that resolves when the callback arrives or times out
    const tokenPromise = new Promise((resolve) => {
      server._resolveToken = resolve;

      const timeout = setTimeout(() => {
        resolve(null);
      }, 5 * 60 * 1000);

      server._timeout = timeout;
    });

    // Open the browser for SSO authentication
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));
    vscode.window.showInformationMessage(
      "Experimental SSO: Sign in via your browser. Waiting for authentication..."
    );

    // Wait for the callback
    const token = await tokenPromise;

    // Clean up
    this._shutdownServer(server);

    if (!token) {
      // Offer CLI import as fallback
      const choice = await vscode.window.showWarningMessage(
        "Browser-based SSO did not complete. Would you like to use the " +
        "terminal-based flow or import from CLI instead?",
        "Open Terminal", "Import from CLI", "Dismiss"
      );
      if (choice === "Open Terminal") {
        return this.loginViaTerminal(workspaceSlug);
      }
      if (choice === "Import from CLI") {
        return this.importFromCLI();
      }
      return false;
    }

    await this.context.secrets.store("cloudsmith-vsc.authToken", token);
    vscode.window.showInformationMessage("SSO authentication successful! Credentials saved.");
    return true;
  }

  /**
   * Start a local HTTP server on port 12400 (the CLI's fixed port).
   * Rejects if the port is unavailable.
   */
  _startCallbackServer(expectedPath) {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this._handleCallbackRequest(req, res, server);
      });
      server._expectedPath = expectedPath;

      server.listen(SAML_CALLBACK_PORT, "127.0.0.1", () => {
        resolve({ server, port: SAML_CALLBACK_PORT });
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port ${SAML_CALLBACK_PORT} is already in use`));
        } else {
          reject(new Error(`Failed to start callback server: ${err.message}`));
        }
      });
    });
  }

  /**
   * Handle an incoming HTTP request on the callback server.
   * Accept only the one-time callback path and avoid logging token-bearing data.
   */
  _handleCallbackRequest(req, res, server) {
    const parsed = url.parse(req.url, true);
    const params = parsed.query || {};
    const pathName = parsed.pathname || "/";

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    if (pathName === CALLBACK_SUCCESS_PATH) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this._buildCallbackHtml(true));
      return;
    }

    if (pathName !== server._expectedPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    // Look for the token in known parameter names
    let token = null;
    for (const name of TOKEN_PARAM_NAMES) {
      if (params[name]) {
        token = params[name];
        break;
      }
    }

    // Resolve the token promise
    if (server._resolveToken) {
      server._resolveToken(token);
      server._resolveToken = null;
    }

    if (token) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(this._buildCallbackHtml(true, CALLBACK_SUCCESS_PATH));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(this._buildCallbackHtml(false));
  }

  /**
   * Shut down the callback server and clear the timeout.
   */
  _shutdownServer(server) {
    if (server._timeout) {
      clearTimeout(server._timeout);
      server._timeout = null;
    }
    try {
      server.close();
    } catch (e) { // eslint-disable-line no-unused-vars
      // Server may already be closed
    }
  }

  _isValidWorkspaceSlug(workspaceSlug) {
    return typeof workspaceSlug === "string" &&
      workspaceSlug.length > 0 &&
      WORKSPACE_SLUG_PATTERN.test(workspaceSlug);
  }

  _buildCallbackHtml(success, replacePath) {
    const heading = success ? "\u2705 Authentication successful" : "\u274C Authentication incomplete";
    const message = success
      ? "You can close this tab and return to VS Code."
      : "No credentials were found in the redirect. Try the terminal-based SSO flow or import from the CLI.";

    const script = replacePath
      ? `<script>if (window.history && window.history.replaceState) { window.history.replaceState(null, "", "${replacePath}"); }</script>`
      : "";

    return "<html><body style=\"font-family:sans-serif;text-align:center;padding:40px\">" +
      `<h2>${heading}</h2>` +
      `<p>${message}</p>` +
      script +
      "</body></html>";
  }
}

module.exports = { SSOAuthManager };
