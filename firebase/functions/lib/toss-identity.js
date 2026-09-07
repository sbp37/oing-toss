import https from 'node:https';

function decode(value) {
  return Buffer.from(String(value || ''), 'base64').toString('utf8');
}

export function verifyTossIdentity(hash, {
  certBase64 = process.env.TOSS_MTLS_CERT_BASE64,
  keyBase64 = process.env.TOSS_MTLS_KEY_BASE64,
  timeoutMs = 8000,
} = {}) {
  if (!hash || !certBase64 || !keyBase64) return Promise.resolve(false);
  return new Promise((resolve) => {
    const request = https.request({
      hostname: 'apps-in-toss-api.toss.im',
      path: '/api-partner/v1/apps-in-toss/users/anon-key/verify',
      method: 'POST',
      cert: decode(certBase64),
      key: decode(keyBase64),
      headers: { accept: 'application/json', 'content-type': 'application/json', 'content-length': '0', 'x-anon-key': String(hash).trim() },
      timeout: timeoutMs,
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          const body = JSON.parse(raw);
          resolve(response.statusCode >= 200 && response.statusCode < 300
            && body?.resultType === 'SUCCESS' && String(body?.success) === 'true');
        } catch { resolve(false); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => resolve(false));
    request.end();
  });
}
