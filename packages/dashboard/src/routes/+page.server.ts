import fs from 'fs';
import path from 'path';
import type { PageServerLoad } from './$types';

const RAW_DIR = path.resolve('/Users/daniel/pro/art-scraper/packages/img-persister/raw');
const API_STATS_URL = 'http://localhost:3001/api/stats';

async function getDiskUsage() {
  try {
    if (!fs.existsSync(RAW_DIR)) {
      return { totalSpaceBytes: 0, totalFiles: 0 };
    }

    const files = await fs.promises.readdir(RAW_DIR);
    let totalSpaceBytes = 0;
    let totalFiles = 0;

    for (const file of files) {
      // Skip hidden files
      if (file.startsWith('.')) continue;

      const filePath = path.join(RAW_DIR, file);
      const stat = await fs.promises.stat(filePath);
      if (stat.isFile()) {
        totalSpaceBytes += stat.size;
        totalFiles++;
      }
    }

    return { totalSpaceBytes, totalFiles };
  } catch (err: any) {
    console.error('[Load] Error scanning raw directory:', err.message);
    return { totalSpaceBytes: 0, totalFiles: 0 };
  }
}

export const load: PageServerLoad = async () => {
  const disk = await getDiskUsage();

  let dbStats = {
    totalArtworks: 0,
    watchedCount: 0,
    houseDistribution: [] as any[],
    saleTypeDistribution: [] as any[],
    currencyDistribution: [] as any[],
    latestArtworks: [] as any[]
  };

  try {
    const res = await fetch(API_STATS_URL);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        dbStats = data;
      }
    }
  } catch (err: any) {
    console.warn('[Load] Could not fetch database stats from Fastify API:', err.message);
  }

  return {
    disk,
    dbStats
  };
};
