import fs from 'fs';
import path from 'path';
import https from 'https';

const targetDir = path.join(process.cwd(), '../frontend/public/images/sivananda_ashram');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const imagesToDownload = [
  {
    name: 'divine_life_gate.jpg',
    url: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'vishwanath_temple.jpg',
    url: 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'yoga_hall.jpg',
    url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'sadhana_room.jpg',
    url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'vedic_library.jpg',
    url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80'
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
  console.log('Downloaded Sivananda Ashram image set successfully!');
}

main();
