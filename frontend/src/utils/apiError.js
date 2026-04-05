/**
 * Read error message from a failed fetch response (JSON or plain text).
 */
export async function getFetchErrorMessage(response, fallback = "Request failed") {
  try {
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const data = await response.json();
      return data.message || data.error || fallback;
    }
    const text = await response.text();
    return text?.trim()?.slice(0, 240) || fallback;
  } catch {
    return fallback;
  }
}
