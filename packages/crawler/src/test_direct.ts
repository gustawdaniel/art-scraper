import axios from 'axios';

const RAW_COOKIE_STRING = 'searchbar=control; SEARCH_TYPE_AHEAD=old; _sp_id.a17c=4fe0152919c8163a.1779810079.3.1779903285.1779897288; cf_clearance=ZjTl8CgTSukbTvnyQGWCVH2x2ov2i09Mt18XD2EvJN0-1779891067-1.2.1.1-MwC1ISXvZd.Lktu7LxriuTj7C4cdf9JtNxmZkpDOP7M9VCO53O5Iv8sKbXUK_VND5SQTUr8w2ZFOE6Zx7rjFfsuv0saNQOitZrfbR5kORw5AhKDJWPb1k3emw.Szoe6k_vNYjaNq00LG1Ml_wSgSK80fLNor92ng4qqntR8OkOyWM7U3AFSB_Pc6ruhGVNk5XoZYs1aFfj8w6q9jGkTaxhXtOw8eQe6EXhlQzVuwhfQ86DyOBcBw9Ainsz.lgxvOh.dJ3ZfwH4sbGw7clsoYAYbQb4W5XnReZUayMm2iAAJkbiUPc3H.1vcFJyaSLaONFd6MQ4vnPTYbbj8DNippLw; g_state={"i_l":1,"i_ll":1779891076850,"i_b":"smVZ1/pRd2qukki3no1AxL1Qa+XR/Lb8Bj73vR65Guw","i_e":{"enable_itp_optimization":0},"i_et":1779810080247,"i_p":1779817287028}; liveagent_oref=; liveagent_vc=2; liveagent_sid=51e05e99-5793-4007-8510-cb10c3b07623; liveagent_ptid=51e05e99-5793-4007-8510-cb10c3b07623; AWSALB=+/1xD1nnXhfY3C+PCkSrtBmKkBZZ5pq7zE+xQvDglOF105wrGtdX6Gk69EuhCvRyK+wvqDNcJxPfyxKa+I4y2LM4BvJCW1osK33zU7Wo2I7CZZTNytL98r0YLCEXemd4hYczTerq5Iv/iFrIrbiMGi49YBgIUOs2Zd0buQVUu33edhp2jO32GhbxT5v+Dw==; AWSALBCORS=+/1xD1nnXhfY3C+PCkSrtBmKkBZZ5pq7zE+xQvDglOF105wrGtdX6Gk69EuhCvRyK+wvqDNcJxPfyxKa+I4y2LM4BvJCW1osK33zU7Wo2I7CZZTNytL98r0YLCEXemd4hYczTerq5Iv/iFrIrbiMGi49YBgIUOs2Zd0buQVUu33edhp2jO32GhbxT5v+Dw==; AZTOKEN-PROD=36D39FF1-2833-4F10-83EE-84DB9AC12AFF; LANG-PROD=en-us; oas-node-sid=s%3AFMqhMT-r3XXFjeEAveGuj3v7t41DrIQX.0ypFRVBaOkm9trXO6Yw7aOH1cXBim%2F6ET0QOv7R4o8I; __cf_bm=6gTaUCMVQkweS1qfkNe7BGDGR2P1l5YXUtv5JGfCrVQ-1779902252.7351282-1.0.1.1-IebkPVvq92k0JNtLjTS29A2rX7FGv8O6EnDit4xNqhg4H2jLdZ1O0OFDFWfFmiJS68IdI89_3Vf1dUMWvdlSeIhk6ukqoBL5bkulFQY0ReriumVWg.jR_5T7iulC1Y0F; _sp_ses.a17c=*';

async function testDirect() {
  const body = {
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
          ],
          filters: 'banned:false AND dateTimeUTCUnix<1779891060 AND onlineOnly:false AND channelIDs:1 AND closed:true',
          highlightPostTag: '</ais-highlight-0000000000>',
          highlightPreTag: '<ais-highlight-0000000000>',
          hitsPerPage: 96,
          maxValuesPerFacet: 50,
          page: 179,
          query: 'painting',
          ruleContexts: '',
          tagFilters: '',
          userToken: 'sFMqhMT-r3XXFjeEAveGuj3v7t41DrIQX0ypFRVBaOkm9trXO6Yw7aOH1cXBim/6ET0QOv7R4o8I',
          getRankingInfo: true,
        },
      },
    ],
    isCatalogPageRequest: false,
  };

  try {
    console.log('Sending direct HTTP fetch to /catResults...');
    const response = await fetch('https://www.invaluable.com/catResults', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Referer': 'https://www.invaluable.com/',
        'Origin': 'https://www.invaluable.com',
        'Sec-GPC': '1',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cookie': RAW_COOKIE_STRING
      },
      body: JSON.stringify(body)
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log('Response preview:', text.substring(0, 500));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testDirect();
