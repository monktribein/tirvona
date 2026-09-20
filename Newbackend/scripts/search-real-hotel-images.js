/**
 * Search and find real photos of the 5 Vrindavan stays
 */
const https = require('https');

function getVqd(query) {
  return new Promise((resolve, reject) => {
    https.get('https://duckduckgo.com/?q=' + encodeURIComponent(query) + '&iax=images&ia=images', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const match = data.match(/vqd=([0-9-]+)/) || data.match(/vqd="([0-9-]+)"/);
        resolve(match ? match[1] : null);
      });
    }).on('error', reject);
  });
}

function getImages(query, vqd) {
  return new Promise((resolve, reject) => {
    https.get('https://duckduckgo.com/i.js?l=wt-wt&o=json&q=' + encodeURIComponent(query) + '&vqd=' + vqd + '&f=,,,&p=1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://duckduckgo.com/'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results || []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

const QUERIES = [
  { key: "sharda", query: "Hotel Sharda Palace Vrindavan hotel photos" },
  { key: "girraj", query: "Girraj Stay Inn Vrindavan photos" },
  { key: "radha", query: "Radha Palace Chaitanya Vihar Vrindavan hotel photos" },
  { key: "prakash", query: "Shri Prakash Dham Chaitanya Vihar Vrindavan guest house photos" },
  { key: "satya", query: "Satya Nikunj Inn Chaitanya Vihar Vrindavan hotel photos" }
];

async function main() {
  for (const q of QUERIES) {
    console.log(`\n=== Searching for: ${q.query} ===`);
    const vqd = await getVqd(q.query);
    if (!vqd) {
      console.log("Could not get VQD for", q.query);
      continue;
    }
    const results = await getImages(q.query, vqd);
    console.log(`Found ${results.length} images for ${q.key}:`);
    for (let i = 0; i < Math.min(8, results.length); i++) {
      const item = results[i];
      console.log(`  [${i + 1}] URL: ${item.image}`);
      console.log(`      Title: ${item.title}`);
    }
  }
}

main().catch(console.error);
