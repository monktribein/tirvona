const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const urls = [
    'https://www.easemytrip.com/hotels/hotel-radha-palace-in-vrindavan-10822093/',
    'https://www.justdial.com/Vrindavan/Hotel-Radha-Palace-In-Chaitanya-Vihar/9999PX565-X565-250909152251-A1E7'
  ];
  for (const u of urls) {
    console.log('\nFetching', u);
    const html = await get(u);
    const matches = html.match(/https:\/\/[^"'\s<>]+\.(?:jpg|jpeg|webp|png)(?:\?[^"'\s<>]*)?/gi) || [];
    const clean = [...new Set(matches)].filter(img => !img.includes('logo') && !img.includes('icon') && !img.includes('analytics'));
    console.log(`Found ${clean.length} image URLs:`);
    clean.slice(0, 10).forEach(img => console.log('  ->', img));
  }
}

run();
