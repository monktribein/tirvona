const https = require('https');

function getRedirectLocation(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.on('error', (e) => resolve({ error: e.message }));
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

async function run() {
  const url = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH8gKO7zqHd5wOxiifsL-4ZnRLgLJF6Li9nzWtQeqRep9RtzlCEgu6wbMn17C3EwUQhwH-PJ1vq2fo_p9QXCNNuphq27ZItNWjiN71jq02lqHHo5vDQ1UWwohFW1lhQKMGXyMXliWpznFByF_yYytufkwkuhIFS8qtwJA==';
  const res = await getRedirectLocation(url);
  console.log('Result:', res);
}

run();
