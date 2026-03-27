const assert = require("assert");
const { SUPPORTED_UPSTREAM_FORMATS, UpstreamChecker } = require("../util/upstreamChecker");

suite("UpstreamChecker Test Suite", () => {
  test("uses the canonical upstream format list for all-format fetches", () => {
    assert.deepStrictEqual(SUPPORTED_UPSTREAM_FORMATS, [
      "alpine",
      "cargo",
      "cocoapods",
      "composer",
      "conda",
      "cran",
      "dart",
      "deb",
      "docker",
      "generic",
      "go",
      "helm",
      "hex",
      "huggingface",
      "luarocks",
      "maven",
      "npm",
      "nuget",
      "python",
      "rpm",
      "ruby",
      "swift",
      "vagrant",
    ]);
  });

  test("returns upstream data without an error when partial failures still yield upstreams", async () => {
    const checker = new UpstreamChecker({});
    checker.getAllUpstreamData = async () => ({
      upstreams: [{ name: "PyPI", _format: "python", upstream_url: "https://pypi.org/" }],
      active: 1,
      total: 1,
      failedFormats: ["alpine"],
      successfulFormats: 1,
    });

    const result = await checker.getAllUpstreams("acme", "example-repo");

    assert.strictEqual(result.error, null);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].name, "PyPI");
  });

  test("returns an error when formats fail and no upstream data is available", async () => {
    const checker = new UpstreamChecker({});
    checker.getAllUpstreamData = async () => ({
      upstreams: [],
      active: 0,
      total: 0,
      failedFormats: ["python"],
      successfulFormats: 0,
    });

    const result = await checker.getAllUpstreams("acme", "empty-repo");

    assert.strictEqual(result.data.length, 0);
    assert.ok(result.error.includes("python"));
  });
});
