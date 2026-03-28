const assert = require("assert");
const {
  isBenignUpstreamFormatError,
  SUPPORTED_UPSTREAM_FORMATS,
  UpstreamChecker,
} = require("../util/upstreamChecker");
const {
  SUPPORTED_UPSTREAM_FORMATS: SHARED_SUPPORTED_UPSTREAM_FORMATS,
} = require("../util/upstreamFormats");

suite("UpstreamChecker Test Suite", () => {
  test("uses the shared canonical upstream format list for all-format fetches", () => {
    assert.strictEqual(SUPPORTED_UPSTREAM_FORMATS, SHARED_SUPPORTED_UPSTREAM_FORMATS);
    assert.deepStrictEqual(SUPPORTED_UPSTREAM_FORMATS, [
      "alpine",
      "cargo",
      "cocoapods",
      "composer",
      "conan",
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
      "raw",
      "rpm",
      "ruby",
      "swift",
      "terraform",
      "vagrant",
    ]);
  });

  [400, 404, 405, 422].forEach((statusCode) => {
    test(`${statusCode} is classified as a benign upstream format error`, () => {
      assert.strictEqual(
        isBenignUpstreamFormatError(`Response status: ${statusCode}`),
        true
      );
    });
  });

  [401, 403, 407, 408, 429].forEach((statusCode) => {
    test(`${statusCode} is classified as a non-benign upstream format error`, () => {
      assert.strictEqual(
        isBenignUpstreamFormatError(`Response status: ${statusCode}`),
        false
      );
    });
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

  test("does not cache non-benign empty upstream results", async () => {
    const cacheUpdates = [];
    const checker = new UpstreamChecker({
      globalState: {
        get() {
          return undefined;
        },
        async update(key, value) {
          cacheUpdates.push({ key, value });
        },
      },
    });

    checker.api.makeRequest = async () => "Response status: 401";

    const result = await checker.getUpstreamDataForFormats("acme", "example-repo", ["python"]);

    assert.deepStrictEqual(result.failedFormats, ["python"]);
    assert.strictEqual(result.upstreams.length, 0);
    assert.strictEqual(cacheUpdates.length, 0);
  });
});
