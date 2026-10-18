export async function syncToLatifCloud(record) {
  const url = process.env.LATIF_CLOUD_URL;
  if (!url) return { synced: false, reason: 'LATIF_CLOUD_URL is not configured' };

  let baseUrl;
  try {
    baseUrl = new URL(url);
  } catch {
    return { synced: false, reason: 'LATIF_CLOUD_URL is invalid' };
  }

  if (baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') {
    return { synced: false, reason: 'LATIF_CLOUD_URL must use http/https' };
  }

  const allowedHosts = (process.env.LATIF_CLOUD_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts.length > 0 && !allowedHosts.includes(baseUrl.hostname.toLowerCase())) {
    return { synced: false, reason: 'LATIF_CLOUD_URL host is not allowed' };
  }

  const endpoint = new URL('/memory', baseUrl);
  const headers = { 'content-type': 'application/json' };
  if (process.env.LATIF_CLOUD_TOKEN) headers.authorization = `Bearer ${process.env.LATIF_CLOUD_TOKEN}`;
  const response = await fetch(endpoint.toString(), {
    method: 'POST', headers, body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error(`LATIF-CLOUD returned HTTP ${response.status}`);
  return { synced: true };
}
