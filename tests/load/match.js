/* eslint-disable */
// k6 load test for Flota Táctica. Run with:
//   k6 run -e BASE_URL=http://localhost:3000 tests/load/match.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    auth: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const email = `load-${__VU}-${__ITER}-${Date.now()}@load.test`;
  const payload = JSON.stringify({
    email,
    password: 'password123',
    displayName: 'Load',
  });
  const headers = { 'content-type': 'application/json' };

  const registered = http.post(`${BASE}/api/auth/register`, payload, { headers });
  check(registered, { 'registered 201': (r) => r.status === 201 });

  if (registered.status !== 201) {
    sleep(1);
    return;
  }

  const token = registered.json('accessToken');
  const authed = http.get(`${BASE}/api/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  check(authed, { 'profile 200': (r) => r.status === 200 });

  const health = http.get(`${BASE}/health`);
  check(health, { 'health ok': (r) => r.status === 200 });

  sleep(1);
}
