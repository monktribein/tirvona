const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };
    https.get(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchHtml(res.headers.location));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function test() {
  console.log("Fetching Booking.com for Girraj Stay Inn...");
  try {
    const html = await fetchHtml("https://www.booking.com/hotel/in/girraj-stay-inn.html");
    const regex = /https:\/\/cf\.bstatic\.com\/xdata\/images\/hotel\/[^\"]+\.jpg[^\"]*/g;
    const matches = html.match(regex) || [];
    const clean = [...new Set(matches.map(m => m.replace(/max[0-9x]+/g, 'max1024x768')))];
    console.log(`Found ${clean.length} images for Girraj Stay Inn:`);
    clean.slice(0, 10).forEach((u, i) => console.log(` [${i+1}] ${u}`));
  } catch (err) {
    console.error("Booking error:", err.message);
  }
}

test();
