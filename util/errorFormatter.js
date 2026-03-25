// Human-readable error message formatter for API errors.

/**
 * Convert a raw API error string into a user-friendly message.
 * @param   {string} errorString  Raw error from CloudsmithAPI (e.g., "Response status: 403 - Forbidden")
 * @returns {string}              Human-readable error message.
 */
function formatApiError(errorString) {
  if (!errorString || typeof errorString !== "string") {
    return "An unknown error occurred.";
  }

  const lower = errorString.toLowerCase();

  if (lower.includes("403") || lower.includes("forbidden")) {
    return "You may not have permission to access this resource.";
  }
  if (lower.includes("401") || lower.includes("unauthorized")) {
    return "Authentication failed. Check your API key or Service Account Token.";
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return "The requested resource was not found. It may have been deleted or moved.";
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many")) {
    return "Rate limited by Cloudsmith API. Please wait a moment and try again.";
  }
  if (lower.includes("enotfound") || lower.includes("etimedout") || lower.includes("econnrefused") || lower.includes("fetch failed") || lower.includes("network")) {
    return "Could not reach the Cloudsmith API. Check your network connection.";
  }
  if (lower.includes("500") || lower.includes("internal server")) {
    return "The Cloudsmith API encountered an internal error. Please try again later.";
  }

  // Truncate long messages
  const truncated = errorString.length > 100 ? errorString.substring(0, 100) + "..." : errorString;
  return "An error occurred: " + truncated;
}

module.exports = { formatApiError };
