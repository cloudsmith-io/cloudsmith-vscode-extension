const assert = require("assert");
const { FORMAT_OPTIONS } = require("../extension");
const { SUPPORTED_UPSTREAM_FORMATS } = require("../util/upstreamFormats");

suite("Extension Test Suite", () => {
  test("uses the shared upstream format list for format picks", () => {
    assert.strictEqual(FORMAT_OPTIONS, SUPPORTED_UPSTREAM_FORMATS);
    assert.ok(FORMAT_OPTIONS.includes("conan"));
    assert.ok(FORMAT_OPTIONS.includes("terraform"));
    assert.ok(FORMAT_OPTIONS.includes("raw"));
  });
});
