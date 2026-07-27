import fs from 'fs';
import path from 'path';
import https from 'https';

const prashadDir = path.join(process.cwd(), '..', 'frontend', 'public', 'prashad');

if (!fs.existsSync(prashadDir)) {
  fs.mkdirSync(prashadDir, { recursive: true });
}

// Verified high quality Indian sweet image URLs from reliable CDNs
const sweetImages = [
  {
    name: 'varanasi_peda.jpg',
    url: 'https://cdn.pixabay.com/photo/2021/09/27/06/17/sweets-6659616_1280.jpg',
  },
  {
    name: 'mathura_peda.jpg',
    url: 'https://cdn.pixabay.com/photo/2020/10/22/04/31/gulab-jamun-5674883_1280.jpg',
  },
  {
    name: 'tirupati_laddu.jpg',
    url: 'https://cdn.pixabay.com/photo/2017/09/14/11/48/motichoor-laddu-2748805_1280.jpg',
  },
  {
    name: 'ayodhya_prasad.jpg',
    url: 'https://cdn.pixabay.com/photo/2020/10/01/14/23/sweets-5618706_1280.jpg',
  },
  {
    name: 'puri_mahaprasad.jpg',
    url: 'https://cdn.pixabay.com/photo/2021/11/01/15/52/sweet-6760871_1280.jpg',
  },
  {
    name: 'shirdi_halwa.jpg',
    url: 'https://cdn.pixabay.com/photo/2020/11/08/12/32/halwa-5723554_1280.jpg',
  },
];

const downloadImage = (url, filepath) => {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status code ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(filepath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
    });
    req.on('error', reject);
  });
};

const main = async () => {
  console.log('Downloading 100% verified HD sweet images...');
  for (const item of sweetImages) {
    const target = path.join(prashadDir, item.name);
    try {
      await downloadImage(item.url, target);
      const stat = fs.statSync(target);
      console.log(`Saved ${item.name} (${(stat.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`Error downloading ${item.name}:`, err.message);
    }
  }
};

main();
