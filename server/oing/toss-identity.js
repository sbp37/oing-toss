import https from 'node:https';

const VERIFY_HOST = 'apps-in-toss-api.toss.im';
const VERIFY_PATH = '/api-partner/v1/apps-in-toss/users/anon-key/verify';

function fromBase64(value) {
  return Buffer.from(String(value || ''), 'base64').toString('utf8');
}

export function verifyTossIdentity(hash, {
  certBase64 = process.env.TOSS_MTLS_CERT_BASE64,
  keyBase64 = process.env.TOSS_MTLS_KEY_BASE64,
  timeoutMs = 8000,
} = {}) {
  const normalized = String(hash || '').trim();
  if (!normalized || !certBase64 || !keyBase64) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(Boolean(value));
    };
    const request = https.request({
      hostname: VERIFY_HOST,
      path: VERIFY_PATH,
      method: 'POST',
      cert: fromBase64(certBase64),
      key: fromBase64(keyBase64),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'content-length': '0',
        'x-anon-key': normalized,
      },
      timeout: timeoutMs,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return finish(false);
        try {
          const result = JSON.parse(body);
          finish(result?.resultType === 'SUCCESS' && String(result?.success) === 'true');
        } catch {
          finish(false);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => finish(false));
    request.end();
  });
}
