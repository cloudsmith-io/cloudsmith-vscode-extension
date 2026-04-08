const SUPPORTED_UPSTREAM_FORMATS = Object.freeze([
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

const SUPPORTED_UPSTREAM_FORMAT_SET = new Set(SUPPORTED_UPSTREAM_FORMATS);

function normalizeUpstreamFormat(format) {
  if (typeof format !== "string") {
    return null;
  }

  const normalized = format.trim().toLowerCase();
  return SUPPORTED_UPSTREAM_FORMAT_SET.has(normalized) ? normalized : null;
}

function getSupportedUpstreamFormats(formats = SUPPORTED_UPSTREAM_FORMATS) {
  const uniqueFormats = [];
  const seen = new Set();

  for (const format of formats) {
    const normalized = normalizeUpstreamFormat(format);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueFormats.push(normalized);
  }

  return uniqueFormats;
}

module.exports = {
  getSupportedUpstreamFormats,
  normalizeUpstreamFormat,
  SUPPORTED_UPSTREAM_FORMATS,
};
