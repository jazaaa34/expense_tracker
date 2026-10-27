/**
 * Utility to compress images (DataURL, File, or Blob) in the browser
 * using HTML5 Canvas to prevent LocalStorage QuotaExceeded errors.
 */

export function compressImage(dataUrlOrFile, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve) => {
    if (!dataUrlOrFile) {
      resolve('');
      return;
    }

    const processDataUrl = (dataUrl) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Export compressed JPEG
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (e) {
          console.warn('Canvas compression error, fallback to original:', e);
          resolve(dataUrl);
        }
      };

      img.onerror = () => {
        resolve(dataUrl);
      };

      img.src = dataUrl;
    };

    if (dataUrlOrFile instanceof File || dataUrlOrFile instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => processDataUrl(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(dataUrlOrFile);
    } else if (typeof dataUrlOrFile === 'string') {
      processDataUrl(dataUrlOrFile);
    } else {
      resolve('');
    }
  });
}
