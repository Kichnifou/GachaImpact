const accessToken = process.env.GACHAIMPACT_ACCESS_TOKEN;
const baseUrl = process.env.GACHAIMPACT_API_URL ?? 'http://127.0.0.1:3001';
const elementKey = process.env.GACHAIMPACT_ELEMENT_KEY;

if (!accessToken) {
  throw new Error('Set GACHAIMPACT_ACCESS_TOKEN locally before running this script.');
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const body = await response.json();

  console.log(`${options.method ?? 'GET'} ${path} -> ${response.status}`, body);

  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status}.`);
  }
}

await request('/api/v1/me');

if (elementKey) {
  await request('/api/v1/me/element', {
    method: 'POST',
    body: JSON.stringify({ elementKey }),
  });
}

await request('/api/v1/me/resources');
await request('/api/v1/wheel/spin', { method: 'POST' });
await request('/api/v1/wheel/spin', { method: 'POST' });
