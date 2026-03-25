// License classifier - classifies SPDX license identifiers into risk tiers.
// Supports compound SPDX expressions and user-configurable restrictive overrides.

const vscode = require("vscode");

class LicenseClassifier {
  static RESTRICTIVE = new Set([
    "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
    "GPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later",
    "GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later",
    "SSPL-1.0",
    "EUPL-1.1", "EUPL-1.2",
    "OSL-3.0",
    "CPAL-1.0",
    "CC-BY-SA-4.0",
    "Sleepycat",
  ]);

  static CAUTIOUS = new Set([
    "LGPL-3.0", "LGPL-3.0-only", "LGPL-3.0-or-later",
    "LGPL-2.1", "LGPL-2.1-only", "LGPL-2.1-or-later",
    "MPL-2.0",
    "EPL-1.0", "EPL-2.0",
    "CDDL-1.0", "CDDL-1.1",
    "CPL-1.0",
    "Artistic-2.0",
    "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0",
  ]);

  static PERMISSIVE = new Set([
    "MIT", "MIT-0",
    "Apache-2.0",
    "BSD-2-Clause", "BSD-3-Clause",
    "ISC",
    "Unlicense",
    "CC0-1.0",
    "0BSD",
    "BSL-1.0",
    "Zlib",
    "PSF-2.0",
    "Python-2.0",
    "CC-BY-4.0",
  ]);

  /**
   * Get the effective restrictive set, merging built-in with user overrides.
   * @returns {Set<string>}
   */
  static _getRestrictiveSet() {
    const builtIn = new Set(LicenseClassifier.RESTRICTIVE);
    try {
      const config = vscode.workspace.getConfiguration("cloudsmith-vsc");
      const userList = config.get("restrictiveLicenses");
      if (Array.isArray(userList)) {
        for (const lic of userList) {
          builtIn.add(lic);
        }
      }
    } catch (e) {  // eslint-disable-line no-unused-vars
      // vscode not available (e.g., in unit tests without mock)
    }
    return builtIn;
  }

  /**
   * Classify an SPDX license identifier into a risk tier.
   *
   * @param   {string|null|undefined} license  SPDX license identifier or expression.
   * @returns {{ tier: string, label: string, icon: string }}
   */
  static classify(license) {
    if (!license || typeof license !== "string" || license.trim() === "") {
      return { tier: "unknown", label: "No license specified", icon: "question" };
    }

    const normalized = license.trim();

    // Split compound SPDX expressions on OR and AND
    const parts = normalized.split(/\s+OR\s+|\s+AND\s+/i);

    const restrictiveSet = LicenseClassifier._getRestrictiveSet();

    let worstTier = "permissive";
    let foundInKnown = false;

    for (const part of parts) {
      const clean = part.trim().replace(/[()]/g, "");

      if (restrictiveSet.has(clean)) {
        return { tier: "restrictive", label: license, icon: "error" };
      }

      if (LicenseClassifier.CAUTIOUS.has(clean)) {
        worstTier = "cautious";
        foundInKnown = true;
      }

      if (LicenseClassifier.PERMISSIVE.has(clean)) {
        foundInKnown = true;
      }
    }

    if (worstTier === "cautious") {
      return { tier: "cautious", label: license, icon: "warning" };
    }

    if (foundInKnown) {
      return { tier: "permissive", label: license, icon: "check" };
    }

    // Not in any known set
    return { tier: "unknown", label: license, icon: "question" };
  }
}

module.exports = { LicenseClassifier };
