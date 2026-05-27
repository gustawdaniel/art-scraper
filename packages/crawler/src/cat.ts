import puppeteer from 'puppeteer';
import axios from 'axios';

const INVALUABLE_BASE = 'https://www.invaluable.com';
const API_BASE = 'http://localhost:3001/api';

// ─── CONFIGURATION ───
// Copy-paste the raw Cookie header string from your browser here.
// The script will automatically parse this and inject it into the Puppeteer session.
const RAW_COOKIE_STRING = 'searchbar=control; SEARCH_TYPE_AHEAD=old; _sp_id.a17c=4fe0152919c8163a.1779810079.3.1779903285.1779897288; cf_clearance=ZjTl8CgTSukbTvnyQGWCVH2x2ov2i09Mt18XD2EvJN0-1779891067-1.2.1.1-MwC1ISXvZd.Lktu7LxriuTj7C4cdf9JtNxmZkpDOP7M9VCO53O5Iv8sKbXUK_VND5SQTUr8w2ZFOE6Zx7rjFfsuv0saNQOitZrfbR5kORw5AhKDJWPb1k3emw.Szoe6k_vNYjaNq00LG1Ml_wSgSK80fLNor92ng4qqntR8OkOyWM7U3AFSB_Pc6ruhGVNk5XoZYs1aFfj8w6q9jGkTaxhXtOw8eQe6EXhlQzVuwhfQ86DyOBcBw9Ainsz.lgxvOh.dJ3ZfwH4sbGw7clsoYAYbQb4W5XnReZUayMm2iAAJkbiUPc3H.1vcFJyaSLaONFd6MQ4vnPTYbbj8DNippLw; g_state={"i_l":1,"i_ll":1779891076850,"i_b":"smVZ1/pRd2qukki3no1AxL1Qa+XR/Lb8Bj73vR65Guw","i_e":{"enable_itp_optimization":0},"i_et":1779810080247,"i_p":1779817287028}; liveagent_oref=; liveagent_vc=2; liveagent_sid=51e05e99-5793-4007-8510-cb10c3b07623; liveagent_ptid=51e05e99-5793-4007-8510-cb10c3b07623; AWSALB=+/1xD1nnXhfY3C+PCkSrtBmKkBZZ5pq7zE+xQvDglOF105wrGtdX6Gk69EuhCvRyK+wvqDNcJxPfyxKa+I4y2LM4BvJCW1osK33zU7Wo2I7CZZTNytL98r0YLCEXemd4hYczTerq5Iv/iFrIrbiMGi49YBgIUOs2Zd0buQVUu33edhp2jO32GhbxT5v+Dw==; AWSALBCORS=+/1xD1nnXhfY3C+PCkSrtBmKkBZZ5pq7zE+xQvDglOF105wrGtdX6Gk69EuhCvRyK+wvqDNcJxPfyxKa+I4y2LM4BvJCW1osK33zU7Wo2I7CZZTNytL98r0YLCEXemd4hYczTerq5Iv/iFrIrbiMGi49YBgIUOs2Zd0buQVUu33edhp2jO32GhbxT5v+Dw==; AZTOKEN-PROD=36D39FF1-2833-4F10-83EE-84DB9AC12AFF; LANG-PROD=en-us; oas-node-sid=s%3AFMqhMT-r3XXFjeEAveGuj3v7t41DrIQX.0ypFRVBaOkm9trXO6Yw7aOH1cXBim%2F6ET0QOv7R4o8I; __cf_bm=6gTaUCMVQkweS1qfkNe7BGDGR2P1l5YXUtv5JGfCrVQ-1779902252.7351282-1.0.1.1-IebkPVvq92k0JNtLjTS29A2rX7FGv8O6EnDit4xNqhg4H2jLdZ1O0OFDFWfFmiJS68IdI89_3Vf1dUMWvdlSeIhk6ukqoBL5bkulFQY0ReriumVWg.jR_5T7iulC1Y0F; _sp_ses.a17c=*';

const CRAWL_QUERY = 'painting';
const START_PAGE = 1;
const PAGES_TO_CRAWL = 1000; // Number of pages to crawl sequentially

/**
 * Parses raw Cookie header string into the object structure required by Puppeteer page.setCookie()
 */
function parseCookies(rawCookieStr: string, domain: string = '.invaluable.com'): any[] {
  return rawCookieStr
    .split(';')
    .map(cookie => {
      const trimmed = cookie.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return null;
      const name = trimmed.substring(0, eqIndex);
      const value = trimmed.substring(eqIndex + 1);
      return {
        name,
        value,
        domain,
        path: '/'
      };
    })
    .filter((c): c is any => c !== null && c.name !== '' && c.value !== '');
}

/**
 * Custom slugify function matching Invaluable's URL schema with a 49-character limit
 */
function slugify(text: string): string {
  let slug = text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Separate accent marks from letters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/[\/]/g, '-') // Replace slashes with hyphens
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters (excluding spaces and hyphens)
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with a single hyphen
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen

  if (slug.length > 49) {
    slug = slug.substring(0, 49).replace(/-+$/, ''); // Truncate and strip trailing hyphens
  }
  return slug;
}

async function main() {
  let browser;
  try {
    console.log('🚀 Starting cat5 crawler (Puppeteer AJAX injection version)...');

    // Launch Chrome in headless mode. 
    // Since Puppeteer uses a real Chrome engine, TLS and HTTP/2 profiles are 100% genuine.
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled' // Helps mask webdriver presence
      ]
    });
    console.log('✅ Chrome launched.');

    const page = await browser.newPage();
    
    // Set viewport and user-agent to match regular desktop
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0');

    // 1. Navigate to invaluable.com first to set the cookie context domain
    console.log('🌐 Step 1: Navigating to invaluable.com to establish context...');
    await page.goto(`${INVALUABLE_BASE}/robots.txt`, { waitUntil: 'domcontentloaded' });
    console.log('✅ Context page loaded.');

    // 2. Set parsed cookies on the active browser session
    const cookies = parseCookies(RAW_COOKIE_STRING);
    console.log(`🍪 Injecting ${cookies.length} session cookies into browser jar...`);
    await page.setCookie(...cookies);
    console.log('✅ Cookies injected successfully.');

    let currentMaxTimestamp = Math.floor(Date.now() / 1000);
    let consecutiveZeroHits = 0;

    // 3. Loop through specified batches
    for (let i = 0; i < PAGES_TO_CRAWL; i++) {
      try {
        console.log(`\n📬 Step 2: Querying /catResults via in-page fetch() (Batch: ${i + 1}/${PAGES_TO_CRAWL}, TimeCursor: < ${currentMaxTimestamp}, Query: "${CRAWL_QUERY}")...`);

        // Construct POST request body
        const postBody = {
          requests: [
            {
              indexName: 'archive_prod',
              params: {
                attributesToRetrieve: [
                  'watched',
                  'dateTimeUTCUnix',
                  'currencyCode',
                  'dateTimeLocal',
                  'lotTitle',
                  'lotNumber',
                  'lotRef',
                  'photoPath',
                  'houseName',
                  'currencySymbol',
                  'currencyCode',
                  'priceResult',
                  'saleType',
                ],
                clickAnalytics: true,
                facets: [
                  'hasImage',
                  'supercategoryName',
                  'artistName',
                  'dateTimeUTCUnix',
                  'houseName',
                  'countryName',
                  'currencyCode',
                  'priceResult',
                  'Fine Art',
                  'Asian Art & Antiques',
                  'Decorative Art',
                  'Collectibles',
                  'Furniture',
                  'Jewelry',
                  'Dolls%2C Bears & Toys',
                  'Firearms',
                  'Wines & Spirits',
                ],
                filters: `banned:false AND dateTimeUTCUnix<${currentMaxTimestamp} AND onlineOnly:false AND channelIDs:1 AND closed:true`,
                highlightPostTag: '</ais-highlight-0000000000>',
                highlightPreTag: '<ais-highlight-0000000000>',
                hitsPerPage: 96,
                maxValuesPerFacet: 50,
                page: 0, // Always page 0 for cursor-based time windowing
                query: CRAWL_QUERY,
                ruleContexts: '',
                tagFilters: '',
                userToken: 'sFMqhMT-r3XXFjeEAveGuj3v7t41DrIQX0ypFRVBaOkm9trXO6Yw7aOH1cXBim/6ET0QOv7R4o8I',
                getRankingInfo: true,
              },
            },
          ],
          isCatalogPageRequest: false,
        };

        // Execute fetch directly within the page context
        const responseJsonString = await page.evaluate(async (url, bodyStr) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Sec-GPC': '1',
              'Referer': 'https://www.invaluable.com/',
              'Origin': 'https://www.invaluable.com'
            },
            body: bodyStr
          });
          
          if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
          }
          
          return response.text();
        }, `${INVALUABLE_BASE}/catResults`, JSON.stringify(postBody));

        const result = JSON.parse(responseJsonString);
        const hits = result.results?.[0]?.hits || [];

        if (hits.length === 0) {
          console.log(`⚠️ No hits returned for time cursor < ${currentMaxTimestamp}.`);
          consecutiveZeroHits++;
          if (consecutiveZeroHits > 10) {
            console.log('🛑 Too many consecutive empty batches. Stopping crawl.');
            break;
          }
          // Shift time window back by 1 day to skip potential gaps
          currentMaxTimestamp -= 86400; 
          console.log(`💤 Shifting cursor back 1 day to < ${currentMaxTimestamp} and waiting 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        consecutiveZeroHits = 0;
        console.log(`📦 Batch ${i + 1} returned ${hits.length} raw hits. Mapping to DB schema...`);

        const artworks = hits.map((hit: any) => {
          const lotTitle = hit.lotTitle || '';
          const lotNumber = hit.lotNumber || '';
          const lotRef = hit.lotRef || '';

          // 1. Image Link
          let imageLink = '';
          if (hit.photoPath) {
            const cleanPath = hit.photoPath.replace(/^\//, '');
            if (!cleanPath.startsWith('housePhotos/')) {
              imageLink = `https://image.invaluable.com/housePhotos/${cleanPath}`;
            } else {
              imageLink = `https://image.invaluable.com/${cleanPath}`;
            }
          }

          // 2. Auction Link (construct slugified URL matching database)
          const slug = slugify(lotTitle || 'lot');
          const baseLink = `https://www.invaluable.com/auction-lot/${slug}-${lotNumber}-c-${lotRef}`;

          // Append identical Algolia tracking parameters found in original DB entries
          const queryParams: string[] = [];
          if (hit.objectID) queryParams.push(`objectID=${hit.objectID}`);
          if (result.results?.[0]?.queryID) {
            queryParams.push(`queryID=${result.results[0].queryID}`);
          }
          queryParams.push('algIndex=archive_prod');
          const auctionLink = `${baseLink}?${queryParams.join('&')}`;

          // 3. Date formatting (e.g. "May 27, 2026")
          let dateStr = '';
          if (hit.dateTimeUTCUnix) {
            dateStr = new Date(hit.dateTimeUTCUnix * 1000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          } else if (hit.dateTimeLocal) {
            dateStr = new Date(hit.dateTimeLocal).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          }

          const auctionHouse = hit.houseName || '';

          return {
            auctionLink,
            imageLink,
            title: lotTitle,
            date: dateStr,
            auctionHouse,
            watched: hit.watched !== undefined ? hit.watched : false,
            dateTimeUTCUnix: hit.dateTimeUTCUnix,
            dateTimeLocal: hit.dateTimeLocal,
            lotNumber: hit.lotNumber,
            lotRef: hit.lotRef,
            photoPath: hit.photoPath,
            currencyCode: hit.currencyCode,
            currencySymbol: hit.currencySymbol,
            priceResult: hit.priceResult,
            saleType: hit.saleType
          };
        }).filter((art: any) => art.auctionLink && art.imageLink);

        console.log(`✅ Formatted ${artworks.length} valid artwork entries.`);

        if (artworks.length > 0) {
          console.log(`💾 Saving batch to API backend...`);
          const apiResponse = await axios.post(`${API_BASE}/artworks`, artworks);
          if (apiResponse.data && apiResponse.data.success) {
            console.log(`🎉 Success! Saved ${apiResponse.data.count} new items (skipped ${apiResponse.data.skipped} duplicates).`);
          } else {
            console.error(`❌ API Error saving items:`, apiResponse.data);
          }
        }

        // 4. Update the time cursor to the oldest item in the batch minus 1 second
        const timestamps = hits
          .map((hit: any) => hit.dateTimeUTCUnix)
          .filter((t: any) => typeof t === 'number' && t > 0);

        if (timestamps.length > 0) {
          const minTimestamp = Math.min(...timestamps);
          currentMaxTimestamp = minTimestamp - 1;
          console.log(`🔄 Time cursor advanced to: < ${currentMaxTimestamp} (Oldest item timestamp: ${minTimestamp})`);
        } else {
          // Fallback if no timestamps returned in hits
          currentMaxTimestamp -= 3600;
          console.log(`🔄 Fallback: shifting time cursor back 1 hour to < ${currentMaxTimestamp}`);
        }

        // Add a polite delay between batches
        if (i < PAGES_TO_CRAWL - 1) {
          console.log('💤 Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (pageError: any) {
        console.error(`❌ Error crawling batch ${i + 1}:`, pageError.message);
      }
    }

  } catch (error: any) {
    console.error('\n💥 Critical Error:', error.message);
  } finally {
    if (browser) {
      console.log('\n🧹 Closing Puppeteer browser...');
      await browser.close();
      console.log('✅ Browser closed.');
    }
  }
}

main();
