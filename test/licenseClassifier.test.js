const assert = require("assert");
const { LicenseClassifier } = require("../util/licenseClassifier");

suite("LicenseClassifier Test Suite", () => {

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
});
