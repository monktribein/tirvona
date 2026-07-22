import fs from 'fs';
import path from 'path';
import https from 'https';

const targetDir = path.join(process.cwd(), '../frontend/public/images/parmarth_niketan');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const imagesToDownload = [
  {
    name: 'shiva_statue.jpg',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'aarti_ghat.jpg',
    url: 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'yoga_hall.jpg',
    url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'campus_gardens.jpg',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'balcony_suite.jpg',
    url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80'
  }
];

const downloadFile = (fileUrl, filePath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(fileUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, filePath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Saved: ${filePath}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
};

async function main() {
  for (const item of imagesToDownload) {
    const dest = path.join(targetDir, item.name);
    try {
      await downloadFile(item.url, dest);
    } catch (e) {
      console.error(`Failed downloading ${item.name}:`, e);
    }
  }
  console.log('Downloaded Parmarth Niketan image set successfully!');
}

main();
