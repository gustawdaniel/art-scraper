import { connect, JSONCodec } from 'nats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';
const RAW_DIR = path.join(__dirname, '../raw');

interface ArtworkEvent {
  id: string;
  title: string;
  imageLink: string;
  auctionLink: string;
}

/**
 * Downloads a file using a Puppeteer page to bypass Cloudflare CDN TLS blocks
 */
async function downloadFileWithPup(page: puppeteer.Page, url: string, destPath: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response) {
    throw new Error('No response received from browser session.');
  }
  
  const status = response.status();
  if (status !== 200) {
    throw new Error(`HTTP Error ${status}: ${response.statusText() || 'Forbidden'}`);
  }
  
  const buffer = await response.buffer();
  
  // Ensure the raw directory exists
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await fs.promises.writeFile(destPath, buffer);
}

async function main() {
  let browser: puppeteer.Browser | null = null;
  try {
    console.log(`🚀 Starting Image Persister Service (Puppeteer CDN Bypass)...`);
    
    // Launch Chrome in headless mode to establish a genuine TLS network connection
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    console.log('✅ Chrome launched for CDN bypass.');

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Mimic Firefox User-Agent and set Referer header to bypass simple CDN hotlinking blocks
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0');
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.invaluable.com/'
    });

    console.log(`Connecting to NATS at ${NATS_URL}...`);
    const nc = await connect({ servers: NATS_URL });
    console.log(`✅ Connected to NATS. Listening for events on subject "artworks.new"...`);

    const jc = JSONCodec<ArtworkEvent>();
    const genericCodec = JSONCodec();
    const sub = nc.subscribe('artworks.new');

    // Create the raw directory on startup if it doesn't exist
    await fs.promises.mkdir(RAW_DIR, { recursive: true });
    console.log(`📂 Storage directory initialized at: ${RAW_DIR}`);

    for await (const m of sub) {
      try {
        const artwork = jc.decode(m.data);
        let { imageLink, title } = artwork;

        if (!imageLink) {
          console.log(`⚠️ Received event with missing imageLink. Skipping.`);
          continue;
        }

        // Auto-prepend housePhotos/ if missing
        if (imageLink.startsWith('https://image.invaluable.com/') && !imageLink.includes('/housePhotos/')) {
          const originalLink = imageLink;
          imageLink = imageLink.replace('https://image.invaluable.com/', 'https://image.invaluable.com/housePhotos/');
          console.log(`🔧 Corrected image URL with housePhotos/ prefix: ${imageLink} (was: ${originalLink})`);
        }

        console.log(`\n──────────────────────────────────────────────────`);
        console.log(`📦 New artwork received: "${title}"`);
        console.log(`🔗 Image URL: ${imageLink}`);

        // 1. Parse filename and extension from standard URL
        const urlObj = new URL(imageLink);
        const filename = path.basename(urlObj.pathname);
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);

        if (!filename || !ext) {
          console.error(`❌ Could not parse filename/extension from URL: ${imageLink}`);
          continue;
        }

        const destPathStandard = path.join(RAW_DIR, filename);

        // 2. Construct original filename and URL with _original suffix before the extension
        const originalFilename = `${base}_original${ext}`;
        const originalDestPath = path.join(RAW_DIR, originalFilename);
        
        // Reconstruct the URL with the _original filename
        const originalImageLink = imageLink.replace(filename, originalFilename);

        // 3. Download the standard image
        try {
          console.log(`📥 Downloading standard image to ${filename}...`);
          const startTime = Date.now();
          await downloadFileWithPup(page, imageLink, destPathStandard);
          const durationMs = Date.now() - startTime;
          const stats = await fs.promises.stat(destPathStandard);
          const sizeBytes = stats.size;
          console.log(`✅ Standard image saved successfully.`);
          
          nc.publish('artworks.download.success', genericCodec.encode({
            id: artwork.id,
            title,
            imageLink,
            filename,
            type: 'standard',
            durationMs,
            sizeBytes,
            timestamp: Date.now()
          }));
        } catch (err: any) {
          console.error(`❌ Failed to download standard image: ${err.message}`);
          nc.publish('artworks.download.error', genericCodec.encode({
            id: artwork.id,
            title,
            imageLink,
            filename,
            type: 'standard',
            error: err.message,
            timestamp: Date.now()
          }));
        }

        // 4. Download the original resolution image (if available)
        try {
          console.log(`📥 Attempting original image download to ${originalFilename}...`);
          const startTimeOrig = Date.now();
          await downloadFileWithPup(page, originalImageLink, originalDestPath);
          const durationMsOrig = Date.now() - startTimeOrig;
          const statsOrig = await fs.promises.stat(originalDestPath);
          const sizeBytesOrig = statsOrig.size;
          console.log(`✅ Original image saved successfully.`);

          nc.publish('artworks.download.success', genericCodec.encode({
            id: artwork.id,
            title,
            imageLink: originalImageLink,
            filename: originalFilename,
            type: 'original',
            durationMs: durationMsOrig,
            sizeBytes: sizeBytesOrig,
            timestamp: Date.now()
          }));
        } catch (err: any) {
          // Many lots on Invaluable do not have high-resolution _original copies, 
          // which returns a 404. We log a warning and continue without failing.
          console.warn(`⚠️ Original size not available or failed: ${err.message}`);
          nc.publish('artworks.download.error', genericCodec.encode({
            id: artwork.id,
            title,
            imageLink: originalImageLink,
            filename: originalFilename,
            type: 'original',
            error: err.message,
            timestamp: Date.now()
          }));
        }

      } catch (eventErr: any) {
        console.error(`❌ Error processing NATS event:`, eventErr.message);
      }
    }

  } catch (error: any) {
    console.error(`💥 Critical error in Image Persister:`, error.message);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

main();
