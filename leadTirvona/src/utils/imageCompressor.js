
export async function compressImage(file, targetMaxBytes = 60000) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not a valid image.'));
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get 2D canvas context.'));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      let maxDim = 1024;
      let quality = 0.75;
      let compressedDataUrl = '';
      let attempt = 0;

      while (attempt < 10) {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        if (compressedDataUrl.length <= targetMaxBytes || maxDim <= 320) {
          break;
        }

        maxDim = Math.round(maxDim * 0.75);
        quality = Math.max(0.35, quality - 0.1);
        attempt++;
      }

      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err || new Error('Failed to load image file for compression.'));
    };

    img.src = objectUrl;
  });
}

export async function compressMultipleImages(files, targetMaxBytes = 60000, onProgress) {
  const compressedResults = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    try {
      const result = await compressImage(files[i], targetMaxBytes);
      compressedResults.push(result);
    } catch (err) {
      console.warn(`[ImageCompressor] Error compressing ${files[i]?.name}:`, err);
    }
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return compressedResults;
}
