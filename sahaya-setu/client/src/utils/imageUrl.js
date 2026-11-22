/**
 * Reusable Image URL Helper for Sahaya Setu
 * Handles local uploads, Cloudinary URLs, relative paths, and provides fallback.
 */

export const FALLBACK_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f1f5f9"/><g fill="%2394a3b8" transform="translate(160, 95)"><path d="M70 10H10C4.5 10 0 14.5 0 20v40c0 5.5 4.5 10 10 10h60c5.5 0 10-4.5 10-10V20c0-5.5-4.5-10-10-10zM10 16h60c2.2 0 4 1.8 4 4v27.2l-14.6-14.6c-1.6-1.6-4.1-1.6-5.7 0L38.4 47.9l-8.6-8.6c-1.6-1.6-4.1-1.6-5.7 0L10 53.4V20c0-2.2 1.8-4 4-4zm60 48H10c-2.2 0-4-1.8-4-4v-1.8l16.7-16.7 8.6 8.6c1.6 1.6 4.1 1.6 5.7 0l15.3-15.3 21.7 21.7V60c0 2.2-1.8 4-4 4z"/><circle cx="26" cy="30" r="6"/></g><text x="200" y="195" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="%2364748b">No Photo Available</text><text x="200" y="218" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="%2394a3b8">Sahaya Setu Civic Records</text></svg>`;

/**
 * Normalizes an image path or URL into a clean, working browser URL.
 * 
 * @param {string|null|undefined} pathOrUrl
 * @param {'reports'|'resolutions'} defaultFolder
 * @returns {string} Fully normalized URL or fallback SVG
 */
export function getImageUrl(pathOrUrl, defaultFolder = 'reports') {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return FALLBACK_IMAGE;
  }

  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return FALLBACK_IMAGE;
  }

  // 1. Data URLs & Blob URLs (user upload previews)
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 2. Full HTTP/HTTPS URLs (Cloudinary or external CDNs)
  // Preserve intact without altering domain or protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 3. Protocol-relative URLs (e.g., //res.cloudinary.com or accidental //filename.png)
  if (trimmed.startsWith('//')) {
    // If it points to an actual domain like Cloudinary
    if (/^\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed) && !trimmed.toLowerCase().includes('.png') && !trimmed.toLowerCase().includes('.jpg')) {
      return `https:${trimmed}`;
    }
    // Otherwise it's a double-slash bug or bare filename treated as host
    const stripped = trimmed.replace(/^\/+/, '');
    return getImageUrl(stripped, defaultFolder);
  }

  // 4. Clean leading slashes
  let clean = trimmed.replace(/^\/+/, '');

  // 5. Clean nested/redundant uploads prefixes and embedded multiple slashes
  while (clean.startsWith('uploads/') || clean.startsWith('/')) {
    clean = clean.replace(/^(uploads\/+|\/+)/, '');
  }

  // 6. If it starts with reports/ or resolutions/
  if (clean.startsWith('reports/') || clean.startsWith('resolutions/')) {
    return `/uploads/${clean}`;
  }

  // 7. If it's a bare filename like '14734.png' or 'pole_before.jpg'
  if (!clean.includes('/')) {
    const isResolution = clean.includes('after') || clean.includes('resol') || defaultFolder === 'resolutions';
    const folder = isResolution ? 'resolutions' : 'reports';
    return `/uploads/${folder}/${clean}`;
  }

  // 8. General fallback for other upload paths
  return `/uploads/${clean}`;
}
