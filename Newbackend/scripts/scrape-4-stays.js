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
  const targets = [
    { name: 'Comfort Inn Braj', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHoG0E2p1evmD9kz1xvRTok-KKrT9osBmOfpIRGIPftaBKZXwluhzMZh02GCfw1exPHl_2AM3-r2Hj5iHza_rU6Qy2jeCU0emuD72kwIlKQcs9KQyHkNk8C3qZ_ePrsLwtwHC2eY1MgqQDtAYGc48X8UQ==' },
    { name: 'Vrindavan Listing Search', url: 'https://www.easemytrip.com/hotels/hotels-in-vrindavan/' }
  ];

  for (const t of targets) {
    console.log(`\n=== Checking ${t.name} ===`);
    const res = await fetchContent(t.url);
    console.log(`Status: ${res.status}, Length: ${res.body.length}`);
    const imgRegex = /https:\/\/img\.easemytrip\.com\/EMTHotel-[^"'\s<>]+\.jpg/gi;
    const matches = [...new Set(res.body.match(imgRegex) || [])];
    console.log(`Found ${matches.length} photos:`);
    matches.slice(0, 10).forEach((m, i) => console.log(`  [${i+1}] ${m}`));
    
    // Check if body mentions Hari Singh or Orchid or Kripa or Comfort
    ['hari singh', 'orchid', 'kripa', 'comfort'].forEach(k => {
      const idx = res.body.toLowerCase().indexOf(k);
      console.log(`Index of '${k}':`, idx);
      if (idx !== -1) {
        console.log(`  Snippet around ${k}:`, res.body.substring(Math.max(0, idx - 100), idx + 200).replace(/\s+/g, ' '));
      }
    });
  }
}

run();
