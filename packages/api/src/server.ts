import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { connect, JSONCodec, NatsConnection } from 'nats';

const prisma = new PrismaClient();
const server = Fastify({
  logger: true
});

let natsConn: NatsConnection | null = null;
const jc = JSONCodec();

const connectNats = async () => {
  try {
    natsConn = await connect({ servers: process.env.NATS_URL || 'nats://localhost:4222' });
    server.log.info('🚀 Connected to NATS successfully.');
  } catch (err) {
    server.log.error('❌ Failed to connect to NATS:', err);
  }
};

server.register(cors, {
  origin: '*'
});

server.get('/', async (request, reply) => {
  try {
    const totalDownloaded = await prisma.artwork.count();
    const latestArtworks = await prisma.artwork.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    const lastDownloadedDate = latestArtworks.length > 0 ? latestArtworks[0].createdAt : null;

    return reply.status(200).send({
      appName: 'art-scraper',
      totalDownloaded,
      lastDownloadedDate,
      latestArtworks
    });
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch app status' });
  }
});

server.post('/api/artworks', async (request, reply) => {
  try {
    const artworks = request.body as any[];

    if (!Array.isArray(artworks)) {
      return reply.status(400).send({ error: 'Body must be an array of artworks' });
    }

    // Filter duplicates within the incoming payload itself
    const seen = new Set();
    const uniqueArtworks = artworks.filter((art) => {
      if (!art.auctionLink) return false;
      if (seen.has(art.auctionLink)) return false;
      seen.add(art.auctionLink);
      return true;
    });

    // Use Promise.allSettled to ensure that unique constraint violations (P2002)
    // or other failures on single items do not block the rest of the batch.
    const results = await Promise.allSettled(
      uniqueArtworks.map((art) =>
        prisma.artwork.create({
          data: {
            auctionLink: art.auctionLink,
            imageLink: art.imageLink,
            title: art.title,
            date: art.date,
            auctionHouse: art.auctionHouse,
            watched: art.watched !== undefined ? art.watched : false,
            dateTimeUTCUnix: art.dateTimeUTCUnix,
            dateTimeLocal: art.dateTimeLocal,
            lotNumber: art.lotNumber,
            lotRef: art.lotRef,
            photoPath: art.photoPath,
            currencyCode: art.currencyCode,
            currencySymbol: art.currencySymbol,
            priceResult: art.priceResult,
            saleType: art.saleType
          }
        })
      )
    );

    const succeededCount = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    
    // Log failures other than Unique Constraint (P2002) for debugging
    failed.forEach((f) => {
      const err = f.reason;
      if (err?.code !== 'P2002') {
        server.log.warn(`Failed to insert artwork: ${err?.message || err}`);
      }
    });

    // Publish NATS events for successfully saved artworks containing imageLink
    results.forEach((r) => {
      if (r.status === 'fulfilled' && natsConn) {
        const createdArtwork = (r as PromiseFulfilledResult<any>).value;
        try {
          natsConn.publish('artworks.new', jc.encode({
            id: createdArtwork.id,
            title: createdArtwork.title,
            imageLink: createdArtwork.imageLink,
            auctionLink: createdArtwork.auctionLink,
            date: createdArtwork.date,
            auctionHouse: createdArtwork.auctionHouse,
            priceResult: createdArtwork.priceResult,
            currencyCode: createdArtwork.currencyCode,
            currencySymbol: createdArtwork.currencySymbol,
            dateTimeUTCUnix: createdArtwork.dateTimeUTCUnix,
            saleType: createdArtwork.saleType
          }));
          server.log.info(`Published NATS artworks.new event for ID: ${createdArtwork.id}`);
        } catch (natsErr) {
          server.log.error(`Failed to publish NATS event: ${natsErr}`);
        }
      }
    });

    return reply.status(200).send({ 
      success: true, 
      count: succeededCount,
      skipped: uniqueArtworks.length - succeededCount
    });
  } catch (error) {
    server.log.error(error);
    return reply.status(500).send({ error: 'Failed to process artworks' });
  }
});

server.get('/api/stats', async (request, reply) => {
  try {
    const totalArtworks = await prisma.artwork.count();
    
    // Group by auction house (top 10)
    const rawHouseStats = await prisma.artwork.groupBy({
      by: ['auctionHouse'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });
    const houseDistribution = rawHouseStats.map(h => ({
      house: h.auctionHouse || 'Unknown',
      count: h._count.id
    }));

    // Group by sale type
    const rawSaleStats = await prisma.artwork.groupBy({
      by: ['saleType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    const saleTypeDistribution = rawSaleStats.map(s => ({
      type: s.saleType || 'Unknown',
      count: s._count.id
    }));

    // Group by currency
    const rawCurrencyStats = await prisma.artwork.groupBy({
      by: ['currencyCode'],
      _count: { id: true }
    });
    const currencyDistribution = rawCurrencyStats.map(c => ({
      currency: c.currencyCode || 'Unknown',
      count: c._count.id
    }));

    const watchedCount = await prisma.artwork.count({
      where: { watched: true }
    });

    const latestArtworks = await prisma.artwork.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    return reply.status(200).send({
      success: true,
      totalArtworks,
      watchedCount,
      houseDistribution,
      saleTypeDistribution,
      currencyDistribution,
      latestArtworks
    });
  } catch (error: any) {
    server.log.error(error);
    return reply.status(500).send({ success: false, error: error.message || 'Failed to compute statistics' });
  }
});

const start = async () => {
  try {
    await connectNats();
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:3001`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
