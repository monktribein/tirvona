/**
 * Update frontend datasets with real Cloudinary URLs for the 5 stays
 */
const fs = require('fs');
const path = require('path');

const uploadedData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'uploaded-stay-images.json'), 'utf-8')
);

// 1. Update frontend/src/data/vrindavanStaysData.ts
const vrnPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'vrindavanStaysData.ts');
let vrnContent = fs.readFileSync(vrnPath, 'utf-8');

// For each stay, replace its images array and room images
for (const [slug, data] of Object.entries(uploadedData)) {
  console.log(`Updating ${slug} in vrindavanStaysData.ts...`);
  
  // Update stay images in vrindavanStaysData
  // Look for the block with slug: "${slug}"
  const stayIdx = vrnContent.indexOf(`slug: "${slug}"`);
  if (stayIdx !== -1) {
    const nextStayIdx = vrnContent.indexOf(`slug: "`, stayIdx + 20);
    const endBlock = nextStayIdx !== -1 ? nextStayIdx : vrnContent.length;
    let block = vrnContent.substring(stayIdx, endBlock);

    // Replace images: [ ... ]
    const stayImgsJson = JSON.stringify(data.stayImages, null, 6).replace(/\n/g, '\n      ');
    block = block.replace(/images:\s*\[[\s\S]*?\],/m, `images: ${stayImgsJson},`);

    // Replace room images if present
    for (const [roomKey, rImgs] of Object.entries(data.roomImages)) {
      const roomImgsJson = JSON.stringify(rImgs, null, 10).replace(/\n/g, '\n          ');
      if (roomKey === 'deluxe' || roomKey === 'luxury' || roomKey === 'double') {
        // First room in stay
        block = block.replace(/(rooms:\s*\[\s*\{[\s\S]*?images:\s*)\[[\s\S]*?\],/m, `$1${roomImgsJson},`);
      } else {
        // Second room in stay
        const secondRoomIdx = block.indexOf('sellingPrice:');
        if (secondRoomIdx !== -1) {
          const sub = block.substring(secondRoomIdx);
          const replacedSub = sub.replace(/(images:\s*)\[[\s\S]*?\],/m, `$1${roomImgsJson},`);
          block = block.substring(0, secondRoomIdx) + replacedSub;
        }
      }
    }

    vrnContent = vrnContent.substring(0, stayIdx) + block + vrnContent.substring(endBlock);
  }
}

fs.writeFileSync(vrnPath, vrnContent, 'utf-8');
console.log('Updated vrindavanStaysData.ts successfully!');

// 2. Update frontend/src/data/premMandirStaysData.ts
const premPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'premMandirStaysData.ts');
let premContent = fs.readFileSync(premPath, 'utf-8');

for (const [slug, data] of Object.entries(uploadedData)) {
  console.log(`Updating ${slug} in premMandirStaysData.ts...`);
  const stayIdx = premContent.indexOf(`slug: "${slug}"`);
  if (stayIdx !== -1) {
    const nextStayIdx = premContent.indexOf(`slug: "`, stayIdx + 20);
    const endBlock = nextStayIdx !== -1 ? nextStayIdx : premContent.length;
    let block = premContent.substring(stayIdx, endBlock);

    // Replace image: "..."
    if (data.stayImages.length > 0) {
      block = block.replace(/image:\s*"[^"]*",/m, `image: "${data.stayImages[0]}",`);
      
      // Replace galleryImages: [ ... ]
      const galJson = JSON.stringify(data.stayImages, null, 6).replace(/\n/g, '\n      ');
      block = block.replace(/galleryImages:\s*\[[\s\S]*?\],/m, `galleryImages: ${galJson},`);
    }

    premContent = premContent.substring(0, stayIdx) + block + premContent.substring(endBlock);
  }
}

fs.writeFileSync(premPath, premContent, 'utf-8');
console.log('Updated premMandirStaysData.ts successfully!');
