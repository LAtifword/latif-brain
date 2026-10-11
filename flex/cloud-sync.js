export async function syncToLatifCloud(record) {
  const url = process.env.LATIF_CLOUD_URL;
  if (!url) return { synced: false, reason: 'LATIF_CLOUD_URL is not configured' };
  const headers = { 'content-type': 'application/json' };
  if (process.env.LATIF_CLOUD_TOKEN) headers.authorization = `Bearer ${process.env.LATIF_CLOUD_TOKEN}`;
  const response = await fetch(`${url.replace(/\/$/, '')}/memory`, {
    method: 'POST', headers, body: JSON.stringify(record),
  });
  if (!response.ok) throw new Error(`LATIF-CLOUD returned HTTP ${response.status}`);
  return { synced: true };
}
