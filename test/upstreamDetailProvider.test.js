const assert = require("assert");
const { UpstreamDetailProvider, SUPPORTED_FORMATS } = require("../views/upstreamDetailProvider");
const { SUPPORTED_UPSTREAM_FORMATS } = require("../util/upstreamFormats");

suite("UpstreamDetailProvider Test Suite", () => {
  test("uses the shared upstream format list", () => {
    assert.strictEqual(SUPPORTED_FORMATS, SUPPORTED_UPSTREAM_FORMATS);
  });

  test("does not show a warning banner when upstreams are available", () => {
    const provider = new UpstreamDetailProvider({});
    const groupedUpstreams = new Map([
      [
        "python",
        [
          {
            name: "PyPI",
            upstream_url: "https://pypi.org/",
            is_active: true,
          },
        ],
      ],
    ]);

    const html = provider._getHtmlContent("acme", "example-repo", "Example Repo", {
      groupedUpstreams,
      failedFormats: ["alpine"],
      successfulFormats: 1,
    });

    assert.ok(html.includes("PyPI"));
    assert.ok(!html.includes("Some upstream formats could not be loaded."));
  });
});
