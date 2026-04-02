import { auth } from './auth';

const BASE_URL = 'http://localhost:5000';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  statusCode?: number;
  data: T;
}

// ── Paths that should NEVER trigger the 401 interceptor ──────────────
// Auth endpoints (refresh/login/register) and profile fetches (called within refresh)
// are excluded to prevent infinite loops and deadlocks.
const NO_INTERCEPT_PATHS = [
  '/api/user/refresh',
  '/api/admin/refresh',
  '/api/user/login',
  '/api/admin/login',
  '/api/user/register',
  '/api/admin/register',
  '/api/user/create',
  '/api/admin/signup',
  '/api/user/profile',
  '/api/admin/profile',
  '/api/user/refresh/logout',
  '/api/admin/refresh/logout',
];

function shouldIntercept(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return !NO_INTERCEPT_PATHS.some(p => normalizedPath.startsWith(p.toLowerCase()));
}

// ── Core fetch wrapper with 401 auto-retry ───────────────────────────
async function fetchWithRetry<T>(
  path: string,
  options: RequestInit,
  isMultipart?: boolean,
  originalBody?: any,
  isRetry: boolean = false, // Prevents infinite recursion
): Promise<ApiResponse<T>> {
  // Build headers (No Bearer token — strictly using cookies)
  const headers: HeadersInit = { ...(options.headers as Record<string, string> || {}) };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent
  });

  // ── 401 Interceptor ──────────────────────────────────────────────
  // If we hit a 401, all concurrent requests await the singleton refresh in auth.ts.
  if (res.status === 401 && shouldIntercept(path) && !isRetry) {
    console.log(`[API] 401 on ${path} — Attempting cookie-based refresh...`);

    const refreshed = await auth.tryRefresh(auth.getIsAdmin());

    if (refreshed) {
      console.log(`[API] Session refreshed — retrying ${path}`);

      const retryOptions: RequestInit = {
        ...options,
        headers: options.headers, // Reuse original headers
        credentials: 'include',
      };

      // Re-attach body for retry (POST/PATCH/PUT)
      if (originalBody !== undefined) {
        retryOptions.body = isMultipart ? originalBody : JSON.stringify(originalBody);
      }

      // Final retry with isRetry set to TRUE to avoid recursion
      return fetchWithRetry<T>(path, retryOptions, isMultipart, originalBody, true);
    } else {
      console.log(`[API] Session refresh failed — logging out`);
      auth.logout();
      return { success: false, message: 'Session expired. Please log in again.', data: null as any };
    }
  }

  // ── Normal response ──────────────────────────────────────────────
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: res.ok, message: text, data: null as any };
  }
}

// ── Public API ───────────────────────────────────────────────────────
export const api = {
  // All token arguments removed since session is cookie-based.
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(path, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async post<T>(path: string, body: any, isMultipart = false): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';

    return fetchWithRetry<T>(path, {
      method: 'POST',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    }, isMultipart, body);
  },

  async patch<T>(path: string, body: any, isMultipart = false): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';

    return fetchWithRetry<T>(path, {
      method: 'PATCH',
      headers,
      body: isMultipart ? body : JSON.stringify(body),
    }, isMultipart, body);
  },

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return fetchWithRetry<T>(path, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
