import { connect, JSONCodec } from 'nats';
import type { RequestHandler } from './$types';

const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

export const GET: RequestHandler = async () => {
  let nc: any;
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(text));
      };

      try {
        console.log(`[SSE] Connecting to NATS at ${NATS_URL}...`);
        nc = await connect({ servers: NATS_URL });
        console.log(`[SSE] Connected to NATS! Subscribing to telemetry topics...`);

        const jc = JSONCodec();

        // 1. Subscribe to artworks.new
        const subNew = nc.subscribe('artworks.new');
        (async () => {
          try {
            for await (const m of subNew) {
              const data = jc.decode(m.data);
              sendEvent('new', data);
            }
          } catch (err) {
            console.error('[SSE] Error in artworks.new loop:', err);
          }
        })();

        // 2. Subscribe to artworks.download.success
        const subSuccess = nc.subscribe('artworks.download.success');
        (async () => {
          try {
            for await (const m of subSuccess) {
              const data = jc.decode(m.data);
              sendEvent('success', data);
            }
          } catch (err) {
            console.error('[SSE] Error in artworks.download.success loop:', err);
          }
        })();

        // 3. Subscribe to artworks.download.error
        const subError = nc.subscribe('artworks.download.error');
        (async () => {
          try {
            for await (const m of subError) {
              const data = jc.decode(m.data);
              sendEvent('error', data);
            }
          } catch (err) {
            console.error('[SSE] Error in artworks.download.error loop:', err);
          }
        })();

      } catch (err: any) {
        console.error('[SSE] NATS Connection failed in SSE endpoint:', err.message);
        sendEvent('system_error', { message: err.message });
        controller.close();
      }
    },
    cancel() {
      console.log('[SSE] Client disconnected. Cleaning up NATS subscription...');
      if (nc) {
        nc.close().catch((err: any) => console.error('[SSE] Error closing NATS:', err));
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
