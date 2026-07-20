import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.resolve(__dirname, '../../../../frontend/public/assets/uploads');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const imagesToDownload = [
  {
    name: 'parmarth-niketan-cover.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Front_entrance_of_the_Parmarth_Niketan%2C_in_Rishikesh%2C_Uttarakhand.jpg'
  },
  {
    name: 'parmarth-niketan-gallery-1.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Statue_of_lord_Shiva_at_the_Parmarth_Niketan%2C_in_Rishikesh%2C_Uttarakhand%2C_India.jpg'
  },
  {
    name: 'parmarth-niketan-gallery-2.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Shiva_statue%2C_Parmarth_Niketan%2C_Rishikesh.jpg'
  },
  {
    name: 'parmarth-niketan-gallery-3.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/Rishikesh_at_night_-_Parmarth_Niketan_Ashram.jpg'
  },
  {
    name: 'parmarth-niketan-gallery-4.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Ganga_Aarti%2C_Rishikesh.jpg'
  },
  {
    name: 'parmarth-niketan-gallery-5.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Gardens_at_Parmarth_Niketan%2C_Muni_Ki_Reti%2C_Rishikesh.jpg'
  },
  {
    name: 'parmarth-niketan-thumbnail.jpg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Front_entrance_of_the_Parmarth_Niketan%2C_in_Rishikesh%2C_Uttarakhand.jpg'
  }
];

function getJpgSize(buffer) {
  let i = 2; // skip SOI marker
  while (i < buffer.length) {
    if (buffer[i] !== 0xFF) return null;
    const marker = buffer[i + 1];
    if (marker === 0xD9) return null; // EOI
    const length = buffer.readUInt16BE(i + 2);
    if (marker === 0xC0 || marker === 0xC2) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }
    i += length + 2;
  }
  return null;
}

const downloadFile = (image) => {
  return new Promise((resolve, reject) => {
    const dest = path.join(targetDir, image.name);
    const fileStream = fs.createWriteStream(dest);

    // Set User-Agent as Wikimedia API requires it to prevent 403 Forbidden errors
    const options = {
      headers: {
        'User-Agent': 'TirvonaApp/1.0 (contact: admin@ashraybharat.gov.in)'
      }
    };

    https.get(image.url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get ${image.url} (Status: ${res.statusCode})`));
        return;
      }
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => {
          // Read image size
          try {
            const buffer = fs.readFileSync(dest);
            const size = getJpgSize(buffer);
            if (size) {
              console.log(`Downloaded ${image.name} (${size.width}x${size.height}px)`);
              if (size.width < 1600) {
                console.warn(`WARNING: ${image.name} width (${size.width}px) is less than 1600px!`);
              }
            } else {
              console.log(`Downloaded ${image.name} (Unable to parse dimensions)`);
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

const run = async () => {
  console.log(`Starting download to target directory: ${targetDir}`);
  for (let img of imagesToDownload) {
    try {
      await downloadFile(img);
    } catch (err) {
      console.error(`Failed to download ${img.name}:`, err.message);
    }
  }
  console.log('Download finished.');
};

run();
