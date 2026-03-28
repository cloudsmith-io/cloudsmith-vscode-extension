const assert = require("assert");

suite("TerraformExporter Fetch Test Suite", () => {
  const upstreamCheckerPath = require.resolve("../util/upstreamChecker");
  const terraformExporterPath = require.resolve("../util/terraformExporter");
  let originalGetAllUpstreamData;

  setup(() => {
    delete require.cache[terraformExporterPath];
    delete require.cache[upstreamCheckerPath];
    const upstreamChecker = require(upstreamCheckerPath);
    originalGetAllUpstreamData = upstreamChecker.getAllUpstreamData;
  });

  teardown(() => {
    const upstreamChecker = require(upstreamCheckerPath);
    upstreamChecker.getAllUpstreamData = originalGetAllUpstreamData;
    delete require.cache[terraformExporterPath];
    delete require.cache[upstreamCheckerPath];
  });

  test("keeps upstream data when some formats fail", async () => {
    const upstreamChecker = require(upstreamCheckerPath);
    upstreamChecker.getAllUpstreamData = async () => ({
      upstreams: [{ name: "PyPI", _format: "python", upstream_url: "https://pypi.org/" }],
      active: 1,
      total: 1,
      failedFormats: ["alpine"],
      successfulFormats: 1,
    });

    const { fetchRepositoryUpstreams } = require(terraformExporterPath);
    const result = await fetchRepositoryUpstreams({}, "acme", "example-repo");

    assert.strictEqual(result.error, null);
    assert.strictEqual(result.data.length, 1);
    assert.deepStrictEqual(result.failedFormats, ["alpine"]);
  });

  test("reports an error only when no upstream data is available", async () => {
    const upstreamChecker = require(upstreamCheckerPath);
    upstreamChecker.getAllUpstreamData = async () => ({
      upstreams: [],
      active: 0,
      total: 0,
      failedFormats: ["python"],
      successfulFormats: 0,
    });

    const { fetchRepositoryUpstreams } = require(terraformExporterPath);
    const result = await fetchRepositoryUpstreams({}, "acme", "empty-repo");

    assert.strictEqual(result.data.length, 0);
    assert.ok(result.error.includes("python"));
  });
});
