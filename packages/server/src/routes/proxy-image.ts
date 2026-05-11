import { Hono } from 'hono';
import { getGhAuthToken } from '../services/github/index.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

/**
 * Proxy GitHub user-attachment images through the server so they can be
 * viewed from localhost (where cross-origin cookies are blocked).
 *
 * GitHub attachment URLs (github.com/user-attachments/assets/...) redirect
 * to short-lived, pre-signed AWS S3 URLs. The initial redirect requires
 * GitHub session cookies, which browsers don't send from localhost due to
 * third-party cookie blocking.
 *
 * This endpoint uses the authenticated gh CLI token to resolve the redirect
 * server-side and returns a 307 to the S3 URL.
 *
 * NOTE: We use redirect: 'manual' because S3 pre-signed URLs return 403 for
 * HEAD requests. We only need the Location header from GitHub's 302.
 */
app.get('/', async (c) => {
  const url = c.req.query('url');
  if (!url) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  // Only allow GitHub user-attachment URLs
  if (!url.startsWith('https://github.com/user-attachments/assets/')) {
    return c.json({ error: 'Invalid URL' }, 400);
  }

  try {
    const token = await getGhAuthToken();

    // Use GET with manual redirect to capture GitHub's 302 Location.
    // Do NOT follow to S3 — HEAD returns 403 on pre-signed URLs and we
    // don't want to waste bandwidth downloading the image body server-side.
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'clm/1.0',
      },
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      // 307 preserves method on redirect and discourages browser caching
      return c.redirect(location, 307);
    }

    // Unexpected — fallback to original URL
    return c.redirect(url, 307);
  } catch (error) {
    logger.error('Failed to proxy image', { url, error });
    return c.redirect(url, 307);
  }
});

export default app;
