// ==============================================================================
// BILL EXTRACTION TEST SCRIPT
// Scans /sample-bills directory, sends each image to POST /api/bills/extract,
// and outputs an extraction summary table with success metrics.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SAMPLE_BILLS_DIR = path.join(WORKSPACE_ROOT, 'sample-bills');
const PORT = process.env.PORT || 5173;
const API_URL = `http://localhost:${PORT}/api/bills/extract`;

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

// Simple sample 1x1 base64 PNG fallback generator for demonstration if empty
function createSampleFallbackImage(filepath) {
  // Minimal valid 1x1 transparent PNG buffer
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  fs.writeFileSync(filepath, Buffer.from(samplePngBase64, 'base64'));
}

async function runTest() {
  console.log('\n=============================================================');
  console.log('🧾 WalletWeather - Bill Extraction Test Runner');
  console.log(`Endpoint: ${API_URL}`);
  console.log(`Directory: ${SAMPLE_BILLS_DIR}`);
  console.log('=============================================================\n');

  if (!fs.existsSync(SAMPLE_BILLS_DIR)) {
    fs.mkdirSync(SAMPLE_BILLS_DIR, { recursive: true });
    console.log(`Created sample directory: ${SAMPLE_BILLS_DIR}`);
    const demoPath = path.join(SAMPLE_BILLS_DIR, 'sample_receipt_demo.png');
    createSampleFallbackImage(demoPath);
    console.log(`Created placeholder test file: sample_receipt_demo.png`);
  }

  const entries = fs.readdirSync(SAMPLE_BILLS_DIR);
  const imageFiles = entries.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return Boolean(MIME_MAP[ext]);
  });

  if (imageFiles.length === 0) {
    console.log(`No images found in ${SAMPLE_BILLS_DIR}.`);
    console.log('Please place sample bill photos (.jpg, .jpeg, .png, .webp) in that folder and run again.');
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to test.\n`);

  const results = [];
  let shopCount = 0;
  let dateCount = 0;
  let totalCount = 0;
  let allThreeCount = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const fullPath = path.join(SAMPLE_BILLS_DIR, file);
    const ext = path.extname(file).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/jpeg';

    process.stdout.write(`[${i + 1}/${imageFiles.length}] Testing "${file}"... `);

    try {
      const fileBuffer = fs.readFileSync(fullPath);
      const base64Data = fileBuffer.toString('base64');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: `data:${mimeType};base64,${base64Data}`,
          mimeType
        })
      });

      const json = await response.json();

      if (response.ok && json.success) {
        const data = json.data || {};
        const hasShop = Boolean(data.shopName);
        const hasDate = Boolean(data.date);
        const hasTotal = data.totalAmount !== null && data.totalAmount !== undefined;

        if (hasShop) shopCount++;
        if (hasDate) dateCount++;
        if (hasTotal) totalCount++;
        if (hasShop && hasDate && hasTotal) allThreeCount++;

        results.push({
          File: file,
          Shop: data.shopName || '(null)',
          Date: data.date || '(null)',
          Total: data.totalAmount !== null ? `₹${data.totalAmount}` : '(null)',
          Confidence: data.confidence !== undefined ? `${(data.confidence * 100).toFixed(0)}%` : '-',
          Status: 'OK'
        });
        console.log('DONE');
      } else {
        results.push({
          File: file,
          Shop: '(error)',
          Date: '(error)',
          Total: '(error)',
          Confidence: '-',
          Status: json.error || `HTTP ${response.status}`
        });
        console.log(`FAILED (${json.error || response.status})`);
      }
    } catch (err) {
      results.push({
        File: file,
        Shop: '(error)',
        Date: '(error)',
        Total: '(error)',
        Confidence: '-',
        Status: err.message
      });
      console.log(`ERROR (${err.message})`);
    }
  }

  console.log('\n=============================================================');
  console.log('RESULTS TABLE');
  console.log('=============================================================');
  console.table(results);

  console.log('\n=============================================================');
  console.log('EXTRACTION ACCURACY METRICS');
  console.log('=============================================================');
  console.log(`Total sample bills tested:      ${imageFiles.length}`);
  console.log(`Shop Name successfully extracted: ${shopCount} / ${imageFiles.length} (${((shopCount / imageFiles.length) * 100).toFixed(1)}%)`);
  console.log(`Date successfully extracted:      ${dateCount} / ${imageFiles.length} (${((dateCount / imageFiles.length) * 100).toFixed(1)}%)`);
  console.log(`Total Amount successfully found:  ${totalCount} / ${imageFiles.length} (${((totalCount / imageFiles.length) * 100).toFixed(1)}%)`);
  console.log(`All 3 core fields extracted:      ${allThreeCount} / ${imageFiles.length} (${((allThreeCount / imageFiles.length) * 100).toFixed(1)}%)`);
  console.log('=============================================================\n');
}

runTest().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
