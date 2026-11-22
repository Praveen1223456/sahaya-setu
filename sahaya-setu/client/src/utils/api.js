// Centralized API configuration supporting custom backend domains (VITE_API_URL)
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function getApiUrl(path = '') {
  if (!path) return API_BASE_URL;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}

// Automatically prefix relative API requests if VITE_API_URL is configured (e.g. deployed on Vercel)
if (typeof window !== 'undefined' && API_BASE_URL) {
  const originalFetch = window.fetch;
  const backendRoutes = [
    '/api',
    '/geo',
    '/reports',
    '/sos',
    '/voice',
    '/track',
    '/incidents',
    '/citizens',
    '/alerts',
    '/shelters',
    '/auth',
    '/outbox',
    '/sitrep',
    '/public',
    '/uploads',
    '/app',
  ];

  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string') {
        const isBackendRoute = backendRoutes.some(
          (route) => input === route || input.startsWith(`${route}/`) || input.startsWith(`${route}?`)
        );
        if (isBackendRoute) {
          input = `${API_BASE_URL}${input}`;
        }
      } else if (input && typeof input === 'object' && input.url) {
        const url = new URL(input.url, window.location.origin);
        const isBackendRoute = backendRoutes.some(
          (route) => url.pathname === route || url.pathname.startsWith(`${route}/`)
        );
        if (isBackendRoute) {
          input = new Request(`${API_BASE_URL}${url.pathname}${url.search}`, input);
        }
      }
    } catch {
      // Fallback to original input
    }
    return originalFetch(input, init);
  };
}
