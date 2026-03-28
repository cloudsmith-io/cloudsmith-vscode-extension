const assert = require("assert");
const vscode = require("vscode");
const { LicenseClassifier } = require("../util/licenseClassifier");

suite("LicenseClassifier Test Suite", () => {
  let originalGetConfiguration;

  setup(() => {
    originalGetConfiguration = vscode.workspace.getConfiguration;
  });

  teardown(() => {
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  // =====================
  // Restrictive licenses
  // =====================

  suite("restrictive licenses", () => {
    const restrictive = [
      "AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later",
      "GPL-3.0", "GPL-3.0-only", "GPL-3.0-or-later",
      "GPL-2.0", "GPL-2.0-only", "GPL-2.0-or-later",
      "SSPL-1.0", "EUPL-1.1", "EUPL-1.2",
      "OSL-3.0", "CPAL-1.0", "CC-BY-SA-4.0", "Sleepycat",
    ];

    for (const lic of restrictive) {
      test(`${lic} returns tier "restrictive"`, () => {
        const result = LicenseClassifier.classify(lic);
        assert.strictEqual(result.tier, "restrictive");
        assert.strictEqual(result.icon, "error");
      });
    }
  });

  // =====================
  // Cautious licenses
  // =====================

  suite("cautious licenses", () => {
    const cautious = [
      "LGPL-3.0", "LGPL-2.1", "MPL-2.0", "EPL-1.0", "EPL-2.0",
      "CDDL-1.0", "CPL-1.0", "Artistic-2.0",
    ];

    for (const lic of cautious) {
      test(`${lic} returns tier "cautious"`, () => {
        const result = LicenseClassifier.classify(lic);
        assert.strictEqual(result.tier, "cautious");
        assert.strictEqual(result.icon, "warning");
      });
    }
  });

  // =====================
  // Permissive licenses
  // =====================

  suite("permissive licenses", () => {
    const permissive = [
      "MIT", "MIT-0", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
      "ISC", "Unlicense", "CC0-1.0", "0BSD", "BSL-1.0", "Zlib",
    ];

    for (const lic of permissive) {
      test(`${lic} returns tier "permissive"`, () => {
        const result = LicenseClassifier.classify(lic);
        assert.strictEqual(result.tier, "permissive");
        assert.strictEqual(result.icon, "check");
      });
    }
  });

  // =====================
  // Compound expressions
  // =====================

  suite("compound SPDX expressions", () => {
    test('"MIT OR GPL-3.0" returns "restrictive" (worst component wins)', () => {
      const result = LicenseClassifier.classify("MIT OR GPL-3.0");
      assert.strictEqual(result.tier, "restrictive");
    });

    test('"MIT OR Apache-2.0" returns "permissive"', () => {
      const result = LicenseClassifier.classify("MIT OR Apache-2.0");
      assert.strictEqual(result.tier, "permissive");
    });

    test('"MIT AND LGPL-3.0" returns "cautious" (worst component)', () => {
      const result = LicenseClassifier.classify("MIT AND LGPL-3.0");
      assert.strictEqual(result.tier, "cautious");
    });

    test('"(MIT OR Apache-2.0) AND GPL-3.0" returns "restrictive"', () => {
      const result = LicenseClassifier.classify("(MIT OR Apache-2.0) AND GPL-3.0");
      assert.strictEqual(result.tier, "restrictive");
    });
  });

  // =====================
  // Unknown / missing
  // =====================

  suite("unknown and missing licenses", () => {
    test("null returns tier unknown", () => {
      const result = LicenseClassifier.classify(null);
      assert.strictEqual(result.tier, "unknown");
      assert.strictEqual(result.label, "No license specified");
    });

    test("undefined returns tier unknown", () => {
      const result = LicenseClassifier.classify(undefined);
      assert.strictEqual(result.tier, "unknown");
    });

    test('empty string returns tier unknown', () => {
      const result = LicenseClassifier.classify("");
      assert.strictEqual(result.tier, "unknown");
    });

    test('whitespace-only returns tier unknown', () => {
      const result = LicenseClassifier.classify("   ");
      assert.strictEqual(result.tier, "unknown");
    });

    test('unrecognized license returns tier unknown', () => {
      const result = LicenseClassifier.classify("CustomLicense-1.0");
      assert.strictEqual(result.tier, "unknown");
      assert.strictEqual(result.icon, "question");
    });

    test("unknown licenses preserve the raw Cloudsmith display value", () => {
      const inspection = LicenseClassifier.inspect("LicenseRef-Cloudsmith-Custom");
      assert.strictEqual(inspection.tier, "unknown");
      assert.strictEqual(inspection.label, "LicenseRef-Cloudsmith-Custom");
      assert.deepStrictEqual(inspection.searchIdentifiers, ["LicenseRef-Cloudsmith-Custom"]);
      assert.strictEqual(inspection.licenseUrl, null);
    });
  });

  // =====================
  // Return structure
  // =====================

  suite("return structure", () => {
    test("classify returns { tier, label, icon }", () => {
      const result = LicenseClassifier.classify("MIT");
      assert.ok(result.tier);
      assert.ok(result.label);
      assert.ok(result.icon);
    });

    test("label preserves original license string", () => {
      const result = LicenseClassifier.classify("Apache-2.0");
      assert.strictEqual(result.label, "Apache-2.0");
    });

    test("label for unknown shows 'No license specified'", () => {
      const result = LicenseClassifier.classify(null);
      assert.strictEqual(result.label, "No license specified");
    });
  });

  suite("shared interpretation helpers", () => {
    test("inspect exposes canonical identifiers and a reusable search query", () => {
      const inspection = LicenseClassifier.inspect("(MIT OR GPL-3.0)");
      assert.deepStrictEqual(inspection.identifiers, ["MIT", "GPL-3.0"]);
      assert.strictEqual(inspection.tier, "restrictive");
      assert.strictEqual(inspection.searchQuery, "(license:MIT OR license:GPL\\-3.0)");
      assert.strictEqual(LicenseClassifier.buildLicenseQuery("(MIT OR GPL-3.0)"), inspection.searchQuery);
    });

    test("buildRestrictiveQuery uses the shared restrictive catalog", () => {
      const query = LicenseClassifier.buildRestrictiveQuery();
      assert.ok(query.includes("license:AGPL\\-3.0"));
      assert.ok(query.includes("license:GPL\\-3.0"));
      assert.ok(query.includes("license:SSPL\\-1.0"));
      assert.ok(query.includes("license:EUPL\\-1.2"));
    });

    test("search quick-pick items reuse the shared query builder", () => {
      const quickPickItems = LicenseClassifier.getSearchQuickPickItems();
      const gplItem = quickPickItems.find((item) => item.label === "GPL-3.0");
      assert.ok(gplItem);
      assert.strictEqual(gplItem.query, LicenseClassifier.buildLicenseQuery("GPL-3.0"));
    });

    test("spdx-only package metadata uses spdx as canonical input and resolves a license URL", () => {
      const inspection = LicenseClassifier.inspect({
        spdx_license: "Apache-2.0",
        license: null,
        raw_license: null,
        license_url: null,
      });

      assert.strictEqual(inspection.label, "Apache-2.0");
      assert.strictEqual(inspection.displayValue, "Apache-2.0");
      assert.strictEqual(inspection.displaySourceField, "spdx_license");
      assert.strictEqual(inspection.canonicalValue, "Apache-2.0");
      assert.strictEqual(inspection.canonicalSourceField, "spdx_license");
      assert.strictEqual(inspection.tier, "permissive");
      assert.strictEqual(inspection.searchQuery, "license:Apache\\-2.0");
      assert.strictEqual(inspection.licenseUrl, "https://spdx.org/licenses/Apache-2.0.html");
      assert.strictEqual(LicenseClassifier.buildLicenseQuery({
        spdx_license: "Apache-2.0",
        license: null,
        raw_license: null,
      }), "license:Apache\\-2.0");
      assert.strictEqual(LicenseClassifier.resolveLicenseUrl({
        spdx_license: "Apache-2.0",
        license: null,
        raw_license: null,
      }), "https://spdx.org/licenses/Apache-2.0.html");
    });

    test("populated package metadata preserves display text while preferring spdx for canonical behavior", () => {
      const inspection = LicenseClassifier.inspect({
        spdx_license: "Apache-2.0",
        license: "Apache 2.0",
        raw_license: "Apache-2.0",
        license_url: null,
      });

      assert.strictEqual(inspection.label, "Apache 2.0");
      assert.strictEqual(inspection.displayValue, "Apache 2.0");
      assert.strictEqual(inspection.displaySourceField, "license");
      assert.strictEqual(inspection.canonicalValue, "Apache-2.0");
      assert.strictEqual(inspection.canonicalSourceField, "spdx_license");
      assert.strictEqual(inspection.spdxIdentifier, "Apache-2.0");
      assert.strictEqual(inspection.tier, "permissive");
      assert.strictEqual(inspection.searchQuery, "license:Apache\\-2.0");
      assert.strictEqual(inspection.licenseUrl, "https://spdx.org/licenses/Apache-2.0.html");
    });

    test("user restrictive overrides apply after base classification", () => {
      vscode.workspace.getConfiguration = () => ({
        get(key) {
          if (key === "restrictiveLicenses") {
            return ["MIT", "LicenseRef-Cloudsmith-Custom"];
          }
          return undefined;
        },
      });

      const mitInspection = LicenseClassifier.inspect("MIT");
      assert.strictEqual(mitInspection.baseTier, "permissive");
      assert.strictEqual(mitInspection.tier, "restrictive");
      assert.strictEqual(mitInspection.overrideApplied, true);
      assert.strictEqual(mitInspection.isRestrictive, true);

      const metadataInspection = LicenseClassifier.inspect({
        spdx_license: "MIT",
        license: "MIT License",
        raw_license: null,
      });
      assert.strictEqual(metadataInspection.canonicalSourceField, "spdx_license");
      assert.strictEqual(metadataInspection.label, "MIT License");
      assert.strictEqual(metadataInspection.tier, "restrictive");
      assert.strictEqual(metadataInspection.overrideApplied, true);

      const customInspection = LicenseClassifier.inspect("LicenseRef-Cloudsmith-Custom");
      assert.strictEqual(customInspection.baseTier, "unknown");
      assert.strictEqual(customInspection.tier, "restrictive");
      assert.strictEqual(customInspection.overrideApplied, true);
      assert.strictEqual(customInspection.label, "LicenseRef-Cloudsmith-Custom");

      const restrictiveItems = LicenseClassifier.getSearchableLicensesByTier().restrictive;
      assert.ok(restrictiveItems.some((item) => item.license === "MIT" && item.overrideApplied));
      assert.ok(restrictiveItems.some((item) => item.license === "LicenseRef-Cloudsmith-Custom" && item.overrideApplied));
      assert.ok(LicenseClassifier.buildRestrictiveQuery().includes("license:LicenseRef\\-Cloudsmith\\-Custom"));
    });
  });
});
