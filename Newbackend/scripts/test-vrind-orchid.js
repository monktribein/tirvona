const https = require('https');

function fetchContent(url) {
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
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', (e) => resolve({ status: 500, error: e.message, body: '' }));
    } catch (e) {
      resolve({ status: 500, error: e.message, body: '' });
    }
  });
}

async function run() {
  const res = await fetchContent('https://www.easemytrip.com/hotels/mathura-emthotel-9771685/');
  console.log('Status:', res.status, 'Length:', res.body.length);
  const regex = /https:\/\/[^"'\s<>]+\.(?:jpg|jpeg|webp|png)(?:\?[^"'\s<>]*)?/gi;
  const matches = [...new Set(res.body.match(regex) || [])];
  const filtered = matches.filter(x => !x.includes('logo') && !x.includes('icon') && !x.includes('flag'));
  console.log(`Found ${filtered.length} image candidates:`);
  filtered.slice(0, 15).forEach((m, i) => console.log(`  [${i+1}] ${m}`));
}

run();
