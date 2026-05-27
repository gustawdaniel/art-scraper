import { connect, JSONCodec } from 'nats';

async function listen() {
  try {
    console.log('Connecting to NATS...');
    const nc = await connect({ servers: 'nats://localhost:4222' });
    console.log('Connected to NATS! Listening for events on subject "artworks.new"...');

    const jc = JSONCodec();
    const sub = nc.subscribe('artworks.new');
    
    for await (const m of sub) {
      const data = jc.decode(m.data);
      console.log(`[Event Received on artworks.new]:`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Error in NATS listener:', err);
  }
}

listen();
