const https = require('https');

function fetchContent(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http') ? res.headers.location : `https://${parsed.hostname}${res.headers.location}`;
          return resolve(fetchContent(redirectUrl));
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', (e) => resolve({ status: 500, error: e.message, body: '' }));
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ status: 408, body: '' });
      });
    } catch (e) {
      resolve({ status: 500, error: e.message, body: '' });
    }
  });
}

async function run() {
  const url = 'https://www.easemytrip.com/hotels/satya-nikunj-inn-emthotel-9316032/';
  console.log('Fetching:', url);
  const res = await fetchContent(url);
  console.log('Status:', res.status, 'Length:', res.body.length);
  const regex = /https:\/\/img\.easemytrip\.com\/EMTHotel-[^"'\s<>]+\.jpg/gi;
  const matches = [...new Set(res.body.match(regex) || [])];
  console.log(`Found ${matches.length} EaseMyTrip photos for Satya Nikunj Inn:`);
  matches.forEach((m, i) => console.log(`  [${i+1}] ${m}`));
}

run();
