// Human-readable error message formatter for API errors.

/**
 * Convert a raw API error string into a user-friendly message.
 * @param   {string} errorString  Raw error from CloudsmithAPI (e.g., "Response status: 403 - Forbidden")
 * @returns {string}              Human-readable error message.
 */
function formatApiError(errorString) {
  if (!errorString || typeof errorString !== "string") {
    return "Could not complete the request.";
  }

  const lower = errorString.toLowerCase();

  if (lower.includes("403") || lower.includes("forbidden")) {
    return "Could not access this resource. Check permissions.";
  }
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Authentication failed. Check the API key.";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "Could not find the requested resource. It may have been deleted or moved.";
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many")) {
    return "Rate limited by the Cloudsmith API. Wait a moment and try again.";
  }
  if (lower.includes("enotfound") || lower.includes("etimedout") || lower.includes("econnrefused") || lower.includes("fetch failed") || lower.includes("network")) {
    return "Could not reach the Cloudsmith API. Check the network connection.";
  }
  if (lower.includes("500") || lower.includes("internal server")) {
    return "The Cloudsmith API returned an internal error. Try again later.";
  }

  // Truncate long messages
  const truncated = errorString.length > 100 ? errorString.substring(0, 100) + "..." : errorString;
  return "Request failed: " + truncated;
}

module.exports = { formatApiError };
