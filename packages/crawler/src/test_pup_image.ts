import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function testPupImage() {
  const url = 'https://image.invaluable.com/housePhotos/poulin/29/812729/H2863-L437085137.jpg';
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Set a legitimate browser user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0');
    await page.setExtraHTTPHeaders({
      'Referer': 'https://www.invaluable.com/'
    });
    
    console.log(`Navigating directly to image URL: ${url}`);
    const response = await page.goto(url);
    if (!response) {
      throw new Error('No response returned.');
    }
    
    console.log(`Response Status: ${response.status()} ${response.statusText()}`);
    const buffer = await response.buffer();
    console.log(`✅ Success! Received buffer of size: ${buffer.length} bytes.`);
    
    const savePath = path.join(__dirname, 'test_downloaded.jpg');
    fs.writeFileSync(savePath, buffer);
    console.log(`Saved test image to: ${savePath}`);
  } catch (err: any) {
    console.error('❌ Failed:', err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testPupImage();
