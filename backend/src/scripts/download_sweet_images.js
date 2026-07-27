import fs from 'fs';
import path from 'path';
import https from 'https';

const prashadDir = path.join(process.cwd(), '..', 'frontend', 'public', 'prashad');

if (!fs.existsSync(prashadDir)) {
  fs.mkdirSync(prashadDir, { recursive: true });
}

const imagesToDownload = [
  {
    filename: 'varanasi_peda.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Mathura_Peda.jpg',
  },
  {
    filename: 'mathura_peda.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Mathura_Peda.jpg',
  },
  {
    filename: 'tirupati_laddu.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Besan_Ladoo.jpg',
  },
  {
    filename: 'ayodhya_prasad.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Besan_Ladoo.jpg',
  },
  {
    filename: 'puri_mahaprasad.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Indian_sweets.jpg',
  },
  {
    filename: 'shirdi_halwa.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Suji_Halwa.jpg',
  },
];

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    };
    https.get(url, options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const run = async () => {
  console.log('Downloading real sweet & prashad images into frontend/public/prashad...');
  for (const img of imagesToDownload) {
    const dest = path.join(prashadDir, img.filename);
    try {
      await downloadFile(img.url, dest);
      console.log(`Successfully downloaded: ${img.filename}`);
    } catch (err) {
      console.error(`Failed to download ${img.filename}:`, err);
    }
  }
  console.log('Finished downloading prashad images.');
};

run();
