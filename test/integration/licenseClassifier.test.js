const assert = require('assert');
const { LicenseClassifier } = require('../../util/licenseClassifier');

suite('Integration: License Classifier', function () {

  suite('restrictive licenses', function () {
    const restrictive = ['AGPL-3.0', 'GPL-3.0', 'GPL-2.0', 'SSPL-1.0'];
    for (const license of restrictive) {
      test(`${license} is classified as restrictive`, function () {
        const result = LicenseClassifier.classify(license);
        assert.strictEqual(result.tier, 'restrictive');
      });
    }
  });

  suite('permissive licenses', function () {
    const permissive = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
    for (const license of permissive) {
      test(`${license} is classified as permissive`, function () {
        const result = LicenseClassifier.classify(license);
        assert.strictEqual(result.tier, 'permissive');
      });
    }
  });

  suite('cautious licenses', function () {
    test('LGPL-3.0 is classified as cautious', function () {
      const result = LicenseClassifier.classify('LGPL-3.0');
      assert.strictEqual(result.tier, 'cautious');
    });

    test('MPL-2.0 is classified as cautious', function () {
      const result = LicenseClassifier.classify('MPL-2.0');
      assert.strictEqual(result.tier, 'cautious');
    });
  });

  suite('unknown and missing licenses', function () {
    test('null returns unknown', function () {
      const result = LicenseClassifier.classify(null);
      assert.strictEqual(result.tier, 'unknown');
    });

    test('undefined returns unknown', function () {
      const result = LicenseClassifier.classify(undefined);
      assert.strictEqual(result.tier, 'unknown');
    });

    test('empty string returns unknown', function () {
      const result = LicenseClassifier.classify('');
      assert.strictEqual(result.tier, 'unknown');
    });

    test('unrecognized license returns unknown', function () {
      const result = LicenseClassifier.classify('CustomLicense-1.0');
      assert.strictEqual(result.tier, 'unknown');
    });
  });

  suite('compound SPDX expressions', function () {
    test('"MIT OR GPL-3.0" returns restrictive (worst component)', function () {
      const result = LicenseClassifier.classify('MIT OR GPL-3.0');
      assert.strictEqual(result.tier, 'restrictive');
    });

    test('"MIT OR Apache-2.0" returns permissive', function () {
      const result = LicenseClassifier.classify('MIT OR Apache-2.0');
      assert.strictEqual(result.tier, 'permissive');
    });

    test('"MIT AND LGPL-3.0" returns cautious', function () {
      const result = LicenseClassifier.classify('MIT AND LGPL-3.0');
      assert.strictEqual(result.tier, 'cautious');
    });
  });

  suite('return structure', function () {
    test('classify returns tier, label, and icon', function () {
      const result = LicenseClassifier.classify('MIT');
      assert.ok('tier' in result, 'Should have tier property');
      assert.ok('label' in result, 'Should have label property');
      assert.ok('icon' in result, 'Should have icon property');
      assert.strictEqual(typeof result.tier, 'string');
      assert.strictEqual(typeof result.label, 'string');
      assert.strictEqual(typeof result.icon, 'string');
    });
  });
});
