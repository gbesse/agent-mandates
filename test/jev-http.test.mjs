// Purpose: Verify the Jev adapter's actual HTTP contract against a local synthetic response server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createJevProvider } from '@gbesse/decisionpacks';
import { reviewIntent } from '../src/jev.mjs';
test('Jev adapter exchanges validated requests over HTTP with explicit deadlines', async () => {
  let requests = 0, serverError;
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, 'POST'); assert.equal(request.url, '/v1/systemone');
      assert.equal(request.headers.authorization, 'Bearer fictional-local-test-key');
      let raw = ''; for await (const chunk of request) raw += chunk;
      const body = JSON.parse(raw); assert.equal(body.model, 'jev-1.13.0'); assert.ok(body.state);
      const answers = Object.fromEntries(Object.entries(body.questions).map(([id, q]) => {
        if (q.type === 'noul') return [id, { type: 'noul', noul: 0.99 }];
        const keys = Object.keys(q.criteria);
        return [id, { type: 'choice', choice: keys[0], confidence: 0.99, probabilities: Object.fromEntries(keys.map((k, i) => [k, i === 0 ? 1 : 0])) }];
      }));
      requests++; response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ model: body.model, answers }));
    } catch (error) { serverError = error; response.writeHead(500); response.end('Invalid test request'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const provider = createJevProvider({ apiKey: 'fictional-local-test-key', endpoint: `http://127.0.0.1:${server.address().port}/v1/systemone`, timeoutMs: 2000 });
    const result = await reviewIntent({ purpose: 'Draft', proposedAction: 'Draft' }, { provider });
    assert.equal(result.authorizationGranted, false); assert.equal(result.status, 'no_drift_flag');
    assert.equal(requests, 1); assert.equal(serverError, undefined);
  } finally { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
