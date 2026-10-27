// ==============================================================================
// API CLIENT - WALLETWEATHER WEB
// Centralized fetch wrapper with robust error handling and base URL support.
// Prevents "Unexpected token 'T', "The page c"... is not valid JSON" errors
// by validating response content-types and providing clear error messages.
// ==============================================================================

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Perform an API request with automated error normalization and non-JSON safety
 * @param {string} endpoint - e.g. '/api/auth/send-otp'
 * @param {RequestInit} [options] - fetch options
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (netErr) {
    throw new Error(`Unable to reach the server. Please check your internet connection and verify the backend is active (${netErr.message}).`);
  }

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // Handle case where server returns HTML, plain text, or empty response
  if (data === null) {
    const rawText = await response.text().catch(() => '');
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`API endpoint not found (HTTP 404): ${cleanEndpoint}. Please verify that backend serverless functions are deployed.`);
      }
      if (response.status === 502 || response.status === 503) {
        throw new Error(`Backend service unavailable (HTTP ${response.status}). Please check server environment configuration.`);
      }
      const safeSnippet = rawText.replace(/<[^>]+>/g, '').trim().slice(0, 120);
      throw new Error(`Server returned error (HTTP ${response.status}): ${safeSnippet || 'Unexpected response'}`);
    }
    throw new Error(`Received unexpected non-JSON response from server for ${cleanEndpoint}.`);
  }

  return { ok: response.ok, status: response.status, data };
}

export { API_BASE_URL };
