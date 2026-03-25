const assert = require("assert");
const PackageNode = require("../models/packageNode");
const SearchResultNode = require("../models/searchResultNode");
const DependencyHealthNode = require("../models/dependencyHealthNode");

suite("Package Metadata Flow Test Suite", () => {
  const pkg = {
    name: "artifact",
    format: "raw",
    repository: "repo-a",
    namespace: "workspace-a",
    status_str: "Completed",
    slug: "artifact-1",
    slug_perm: "artifact-1-perm",
    downloads: 5,
    version: "1.0.0",
    uploaded_at: "2026-03-25T00:00:00Z",
    checksum_sha256: "abc123",
    cdn_url: "https://cdn.example.com/artifact.bin",
    filename: "artifact.bin",
  };

  test("PackageNode preserves install-command metadata", () => {
    const node = new PackageNode(pkg, {});
    assert.strictEqual(node.checksum_sha256, "abc123");
    assert.strictEqual(node.cdn_url, "https://cdn.example.com/artifact.bin");
    assert.strictEqual(node.filename, "artifact.bin");
  });

  test("SearchResultNode preserves install-command metadata", () => {
    const node = new SearchResultNode(pkg, {});
    assert.strictEqual(node.checksum_sha256, "abc123");
    assert.strictEqual(node.cdn_url, "https://cdn.example.com/artifact.bin");
    assert.strictEqual(node.filename, "artifact.bin");
  });

  test("DependencyHealthNode preserves install-command metadata", () => {
    const node = new DependencyHealthNode({
      name: "artifact",
      version: "1.0.0",
      format: "raw",
      devDependency: false,
    }, pkg, {});
    assert.strictEqual(node.checksum_sha256, "abc123");
    assert.strictEqual(node.cdn_url, "https://cdn.example.com/artifact.bin");
    assert.strictEqual(node.filename, "artifact.bin");
  });
});
