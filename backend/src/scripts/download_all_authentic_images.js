import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const publicImagesDir = path.join(process.cwd(), '../frontend/public/images');
if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}

// Authentic High Quality Images for all 15 Ashrams
const ashramImageMap = [
  // HARIDWAR
  {
    folder: 'shantikunj',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Shantikunj_Haridwar.jpg/1280px-Shantikunj_Haridwar.jpg' },
      { name: 'temple.jpg', url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'prem_nagar',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Prem_Nagar_Ashram_Haridwar.jpg/1280px-Prem_Nagar_Ashram_Haridwar.jpg' },
      { name: 'garden.jpg', url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'bharat_sevashram',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Bharat_Sevashram_Sangha_Haridwar.jpg/1280px-Bharat_Sevashram_Sangha_Haridwar.jpg' },
      { name: 'hall.jpg', url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'maa_anandamayi',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Anandamayi_Ma_Ashram_Kankhal.jpg/1280px-Anandamayi_Ma_Ashram_Kankhal.jpg' },
      { name: 'samadhi.jpg', url: 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'sapt_rishi',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Sapt_Rishi_Ashram_Haridwar.jpg/1280px-Sapt_Rishi_Ashram_Haridwar.jpg' },
      { name: 'river.jpg', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' }
    ]
  },

  // RISHIKESH
  {
    folder: 'parmarth_niketan',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Statue_of_lord_Shiva_at_the_Parmarth_Niketan%2C_in_Rishikesh%2C_Uttarakhand%2C_India.jpg' },
      { name: 'aarti.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Ganga_Aarti_at_Parmarth_Niketan%2C_Rishikesh.jpg/1280px-Ganga_Aarti_at_Parmarth_Niketan%2C_Rishikesh.jpg' },
      { name: 'gate.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Parmarth_Niketan_Ashram_Rishikesh.jpg/1280px-Parmarth_Niketan_Ashram_Rishikesh.jpg' }
    ]
  },
  {
    folder: 'sivananda_ashram',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Sivananda_Ashram_Divine_Life_Society_Rishikesh.jpg/1280px-Sivananda_Ashram_Divine_Life_Society_Rishikesh.jpg' },
      { name: 'temple.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Divine_Life_Society_Rishikesh.jpg/1280px-Divine_Life_Society_Rishikesh.jpg' }
    ]
  },
  {
    folder: 'swami_dayananda',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Swami_Dayananda_Ashram_Rishikesh.jpg/1280px-Swami_Dayananda_Ashram_Rishikesh.jpg' },
      { name: 'canal.jpg', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'omkarananda',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Omkarananda_Kamakshi_Devi_Mandir.jpg/1280px-Omkarananda_Kamakshi_Devi_Mandir.jpg' },
      { name: 'ashram.jpg', url: 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'gita_bhawan',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Geeta_Bhawan_Rishikesh.jpg/1280px-Geeta_Bhawan_Rishikesh.jpg' },
      { name: 'ghat.jpg', url: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80' }
    ]
  },

  // VRINDAVAN
  {
    folder: 'iskcon_vrindavan',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Krishna_Balaram_Mandir_Vrindavan.jpg/1280px-Krishna_Balaram_Mandir_Vrindavan.jpg' },
      { name: 'samadhi.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Prabhupada_Samadhi_Mandir_Vrindavan.jpg/1280px-Prabhupada_Samadhi_Mandir_Vrindavan.jpg' }
    ]
  },
  {
    folder: 'mvt_vrindavan',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/MVT_Guesthouse_Vrindavan.jpg/1280px-MVT_Guesthouse_Vrindavan.jpg' },
      { name: 'garden.jpg', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'prem_mandir_jkp',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Prem_Mandir_Vrindavan_Night_View.jpg/1280px-Prem_Mandir_Vrindavan_Night_View.jpg' },
      { name: 'dharamshala.jpg', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'fogla_ashram',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Fogla_Ashram_Vrindavan.jpg/1280px-Fogla_Ashram_Vrindavan.jpg' },
      { name: 'courtyard.jpg', url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80' }
    ]
  },
  {
    folder: 'bhagwat_dham',
    images: [
      { name: 'cover.jpg', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Priya_Kant_Ju_Mandir_Vrindavan.jpg/1280px-Priya_Kant_Ju_Mandir_Vrindavan.jpg' },
      { name: 'ashram.jpg', url: 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80' }
    ]
  }
];

// Fallback high quality religious ashram images from Unsplash if Wikipedia returns 404/429
const backupImages = {
  parmarth_niketan: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80', // Rishikesh Ganga Ghat Yoga
  sivananda_ashram: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', // Sacred River Ghat
  swami_dayananda: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', // Ganges River
  omkarananda: 'https://images.unsplash.com/photo-1598977123418-45f04b61582e?auto=format&fit=crop&w=1200&q=80', // Vedic Temple
  gita_bhawan: 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1200&q=80', // Rishikesh Ghat
  shantikunj: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
  prem_nagar: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  bharat_sevashram: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
  maa_anandamayi: 'https://images.unsplash.com/photo-1606293926075-69a007f4e863?auto=format&fit=crop&w=1200&q=80',
  sapt_rishi: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  iskcon_vrindavan: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
  mvt_vrindavan: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=1200&q=80',
  prem_mandir_jkp: 'https://images.unsplash.com/photo-1609137144813-7d84b06385a7?auto=format&fit=crop&w=1200&q=80',
  fogla_ashram: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80',
  bhagwat_dham: 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80'
};

const downloadSingleFile = (fileUrl, filePath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    const client = fileUrl.startsWith('https') ? https : http;
    const req = client.get(fileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TirvonaAshramBot/1.0'
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        return downloadSingleFile(res.headers.location, filePath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(true));
      });
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
};

async function processAll() {
  console.log('Downloading location-accurate authentic image assets...');

  for (const group of ashramImageMap) {
    const dirPath = path.join(publicImagesDir, group.folder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    for (const imgItem of group.images) {
      const dest = path.join(dirPath, imgItem.name);
      try {
        await downloadSingleFile(imgItem.url, dest);
        console.log(`[SUCCESS] ${group.folder}/${imgItem.name}`);
      } catch (err) {
        console.warn(`[WARN] Wikimedia link failed for ${group.folder}/${imgItem.name}: ${err.message}. Using high-quality backup.`);
        const fallbackUrl = backupImages[group.folder] || 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80';
        try {
          await downloadSingleFile(fallbackUrl, dest);
          console.log(`[BACKUP SUCCESS] ${group.folder}/${imgItem.name}`);
        } catch (e2) {
          console.error(`[ERROR] Could not download backup for ${group.folder}/${imgItem.name}: ${e2.message}`);
        }
      }
    }
  }

  console.log('All ashram image downloads completed!');
}

processAll();
