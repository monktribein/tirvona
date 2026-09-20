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
  const queryUrl = 'https://www.easemytrip.com/hotels/hotels-in-vrindavan/';
  const html = await get(queryUrl);
  const regex = /EMTHotel-\d+/g;
  const matches = [...new Set(html.match(regex) || [])];
  console.log("Matched EMTHotel IDs on Vrindavan listing:", matches.slice(0, 20));

  // Let's also search for 'Satya' and 'Prakash' in html
  const lines = html.split('\n');
  for (const line of lines) {
    if (line.includes('Satya') || line.includes('Prakash') || line.includes('Radha') || line.includes('Girraj')) {
      console.log('Found line:', line.trim().substring(0, 150));
    }
  }
}

run();
