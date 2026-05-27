<script lang="ts">
  import { onMount } from 'svelte';

  // Svelte 5 Props
  let { data } = $props();

  // Runes for reactive state matching data returned from +page.server.ts
  let totalArtworks = $state(data.dbStats.totalArtworks);
  let watchedCount = $state(data.dbStats.watchedCount);
  let diskFiles = $state(data.disk.totalFiles);
  let diskBytes = $state(data.disk.totalSpaceBytes);
  let houseStats = $state(data.dbStats.houseDistribution);
  let saleStats = $state(data.dbStats.saleTypeDistribution);
  let latestArts = $state(data.dbStats.latestArtworks);

  // Live telemetry metrics
  let logs = $state<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([
    { id: 'init', time: new Date().toLocaleTimeString(), text: 'SYSTEM QUANTUM CORE INITIALIZED: Awaiting telemetric stream...', type: 'info' }
  ]);
  let speeds = $state<number[]>(Array(20).fill(0)); // last 20 download speeds in MB/s
  let currentSpeed = $state(0);
  let totalBytesSaved = $state(0);
  let errorCount = $state(0);
  let isConnected = $state(false);

  // Derived state for SVG path calculation
  let pathD = $derived.by(() => {
    const width = 400;
    const height = 150;
    const padding = 15;
    const maxVal = Math.max(...speeds, 1);
    
    return speeds.map((val, i) => {
      const x = padding + (i * (width - 2 * padding)) / (speeds.length - 1);
      const y = (height - padding) - (val * (height - 2 * padding)) / maxVal;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  });

  let fillD = $derived(`${pathD} L 385 135 L 15 135 Z`);

  // Byte size helper
  function formatBytes(bytes: number) {
    if (bytes === 0) return '0.00 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Canvas Backdrop & EventSource Connection
  let canvas: HTMLCanvasElement;
  onMount(() => {
    // 1. Matrix Digital Rain Animation
    const ctx = canvas.getContext('2d');
    if (ctx) {
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const alphabet = "0123456789$+-*/=<>!?:;@#&%_ｦｧｨｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
      const fontSize = 14;
      const columns = width / fontSize;
      const rainDrops = Array.from({ length: columns }).fill(1) as number[];

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < rainDrops.length; i++) {
          const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
          const x = i * fontSize;
          const y = rainDrops[i] * fontSize;

          // Occasionally draw a bright white symbol for high-contrast glowing trails
          if (Math.random() > 0.985) {
            ctx.fillStyle = '#FFFFFF';
          } else {
            ctx.fillStyle = '#00FF41';
          }
          ctx.fillText(text, x, y);

          if (y > height && Math.random() > 0.975) {
            rainDrops[i] = 0;
          }
          rainDrops[i]++;
        }
      };

      const interval = setInterval(draw, 33);

      const handleResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', handleResize);

      // 2. Telemetry Stream (SSE)
      const eventSource = new EventSource('/api/events');
      
      eventSource.onopen = () => {
        isConnected = true;
        addLog('NATS LIVE TELEMETRY BRIDGE CONNECTED', 'success');
      };

      eventSource.onerror = () => {
        isConnected = false;
        addLog('NATS CONNECTION TERMINATED. ATTEMPTING RECONNECT...', 'error');
      };

      eventSource.addEventListener('new', (e: MessageEvent) => {
        const item = JSON.parse(e.data);
        totalArtworks++;
        latestArts = [item, ...latestArts.slice(0, 9)];
        addLog(`CRAWLER IMPORT: [${item.title.substring(0, 30)}...] saved to database`, 'info');
      });

      eventSource.addEventListener('success', (e: MessageEvent) => {
        const item = JSON.parse(e.data);
        diskFiles++;
        diskBytes += item.sizeBytes;
        totalBytesSaved += item.sizeBytes;
        
        // Calculate speed (MB/s)
        const durationSec = (item.durationMs || 1) / 1000;
        const sizeMB = item.sizeBytes / (1024 * 1024);
        const speed = sizeMB / durationSec;
        
        currentSpeed = speed;
        speeds = [...speeds.slice(1), speed];

        addLog(`TELEMETRY RECV: Saved ${item.type.toUpperCase()} image [${item.filename}] in ${item.durationMs}ms at ${speed.toFixed(2)} MB/s`, 'success');
      });

      eventSource.addEventListener('error', (e: MessageEvent) => {
        const item = JSON.parse(e.data);
        errorCount++;
        addLog(`CDN DETECTED BLOCK/ERROR: Failed to save standard copy for lot "${item.title.substring(0, 20)}": ${item.error}`, 'error');
      });

      return () => {
        clearInterval(interval);
        window.removeEventListener('resize', handleResize);
        eventSource.close();
      };
    }
  });

  function addLog(text: string, type: 'info' | 'success' | 'warn' | 'error') {
    const newLog = {
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      text,
      type
    };
    logs = [newLog, ...logs].slice(0, 100);
  }
</script>

<svelte:head>
  <title>ART-SCRAPER // QUANTUM TELEMETRY CORE</title>
</svelte:head>

<!-- CRT Scanning line and overlay effects -->
<div class="crt-overlay"></div>
<div class="crt-scanline"></div>

<!-- Background Matrix Falling Code -->
<canvas bind:this={canvas} class="matrix-canvas"></canvas>

<!-- Foreground Cyberpunk Grid -->
<main class="dashboard-wrapper">
  
  <!-- Header Banner -->
  <header class="hacker-header">
    <div class="logo-area">
      <span class="pulsate-indicator {isConnected ? 'active' : 'inactive'}"></span>
      <h1>ART-SCRAPER // QUANTUM CORE</h1>
    </div>
    <div class="core-details">
      <div class="metric-node">
        <span class="label">NATS:</span>
        <span class="val {isConnected ? 'color-green' : 'color-red'}">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
      </div>
      <div class="metric-node">
        <span class="label">SECURE ENCRYPT:</span>
        <span class="val color-green">ACTIVE (SSH_TLSv1.3)</span>
      </div>
      <div class="metric-node">
        <span class="label">NODE TIME:</span>
        <span class="val color-green">{new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  </header>

  <!-- Content Grid -->
  <section class="diagnostic-grid">
    
    <!-- Row 1: Core System Diagnostics -->
    <div class="glass-panel stat-panel col-4">
      <div class="panel-header">
        <span class="icon">▰</span> SYSTEM DIAGNOSTICS
      </div>
      <div class="panel-body flex-row">
        <div class="stat-group">
          <span class="label">DISK MASS SAVED</span>
          <span class="big-val glowing-green">{formatBytes(diskBytes)}</span>
          <span class="sub-label">TOTAL STORAGE NODE</span>
        </div>
        <div class="stat-group border-left">
          <span class="label">ARCHIVED ASSETS</span>
          <span class="big-val glowing-green">{diskFiles} <span class="unit">files</span></span>
          <span class="sub-label">STD & HIGH-RES IMAGES</span>
        </div>
      </div>
    </div>

    <div class="glass-panel stat-panel col-4">
      <div class="panel-header">
        <span class="icon">▰</span> DB QUANTUM CORE
      </div>
      <div class="panel-body flex-row">
        <div class="stat-group">
          <span class="label">UNIQUE ELEMENTS</span>
          <span class="big-val glowing-green">{totalArtworks}</span>
          <span class="sub-label">POSTGRES DEDUPLICATED</span>
        </div>
        <div class="stat-group border-left">
          <span class="label">WATCHED ASSETS</span>
          <span class="big-val glowing-green">{watchedCount}</span>
          <span class="sub-label">HIGH-PRIORITY WATCHLIST</span>
        </div>
      </div>
    </div>

    <div class="glass-panel stat-panel col-4">
      <div class="panel-header">
        <span class="icon">▰</span> NETWORK Telemetry
      </div>
      <div class="panel-body flex-row">
        <div class="stat-group">
          <span class="label">LIVE SAVE RATE</span>
          <span class="big-val glowing-green">{currentSpeed.toFixed(2)} <span class="unit">MB/s</span></span>
          <span class="sub-label">LAST INCOMING BUNDLE</span>
        </div>
        <div class="stat-group border-left">
          <span class="label">NETWORK FAULTS</span>
          <span class="big-val glowing-red">{errorCount}</span>
          <span class="sub-label">CDN 403/404 BLOCKS</span>
        </div>
      </div>
    </div>

    <!-- Row 2: Speed Chart & Source stats -->
    <div class="glass-panel chart-panel col-8">
      <div class="panel-header">
        <span class="icon">▰</span> TELEMETRY LINE CORE: DOWNLOAD SPEED (MB/s)
      </div>
      <div class="panel-body chart-wrapper">
        <svg viewBox="0 0 400 150" class="speed-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00FF41" stop-opacity="0.45"/>
              <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
            </linearGradient>
          </defs>
          
          <!-- Grid Lines -->
          <line x1="15" y1="15" x2="385" y2="15" stroke="#003300" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="15" y1="45" x2="385" y2="45" stroke="#003300" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="15" y1="75" x2="385" y2="75" stroke="#003300" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="15" y1="105" x2="385" y2="105" stroke="#003300" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="15" y1="135" x2="385" y2="135" stroke="#005500" stroke-width="0.8" />
          
          <!-- Glowing filled area -->
          {#if speeds.some(v => v > 0)}
            <path d={fillD} fill="url(#chart-glow)" />
            <!-- Glowing Line -->
            <path d={pathD} fill="none" stroke="#00FF41" stroke-width="2" class="glowing-path" />
          {:else}
            <text x="200" y="80" fill="#006600" font-family="monospace" text-anchor="middle" font-size="12">NO SPEED METRICS REGISTERED // CORE IDLE</text>
          {/if}
        </svg>
      </div>
    </div>

    <div class="glass-panel data-panel col-4">
      <div class="panel-header">
        <span class="icon">▰</span> DB CORE: SOURCE DISTRIBUTION
      </div>
      <div class="panel-body distribution-list">
        {#each houseStats as h}
          <div class="dist-row">
            <div class="dist-labels">
              <span class="name">{h.house.substring(0, 20)}</span>
              <span class="count">{h.count} lots</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: {(h.count / Math.max(...houseStats.map(x => x.count), 1) * 100)}%"></div>
            </div>
          </div>
        {:else}
          <div class="no-data">AWAITING DB INDEX DATA</div>
        {/each}
      </div>
    </div>

    <!-- Row 3: Log Console & Data Stream -->
    <div class="glass-panel console-panel col-7">
      <div class="panel-header">
        <span class="icon">▰</span> Live Telemetry Event stream (artworks.download.*)
      </div>
      <div class="panel-body console-log">
        <div class="console-wrapper">
          {#each logs as log (log.id)}
            <div class="log-line type-{log.type}">
              <span class="time">[{log.time}]</span>
              <span class="bullet">&gt;</span>
              <span class="text">{log.text}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="glass-panel list-panel col-5">
      <div class="panel-header">
        <span class="icon">▰</span> LIVE DATABASE IMPORT CORE
      </div>
      <div class="panel-body art-list-wrapper">
        <table class="art-table">
          <thead>
            <tr>
              <th>TITLE</th>
              <th>AUCTION HOUSE</th>
              <th>PRICE</th>
              <th>TYPE</th>
            </tr>
          </thead>
          <tbody>
            {#each latestArts as art}
              <tr>
                <td class="col-title" title={art.title}>{art.title}</td>
                <td>{art.auctionHouse || 'N/A'}</td>
                <td class="color-green font-bold">
                  {art.currencySymbol || ''}{art.priceResult ? art.priceResult.toLocaleString() : 'N/A'}
                </td>
                <td>
                  <span class="badge badge-{art.saleType === 'Live' ? 'green' : 'blue'}">{art.saleType || 'Closed'}</span>
                </td>
              </tr>
            {:else}
              <tr>
                <td colspan="4" class="no-data">NO RECENT ACQUISITIONS REGISTERED IN DATABASE</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

  </section>
</main>

<style>
  /* Base reset and theme variables in Matrix green-on-black */
  :global(body) {
    background-color: #000000;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    font-family: 'Courier New', Courier, monospace;
    color: #00FF41;
  }

  /* Matrix canvas rendering */
  .matrix-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    opacity: 0.15;
    pointer-events: none;
  }

  /* CRT Screen Effect overlay */
  .crt-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(circle, rgba(0, 20, 0, 0) 50%, rgba(0, 0, 0, 0.4) 100%);
    z-index: 9999;
    pointer-events: none;
  }

  /* Scanning CRT grid */
  .crt-scanline {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%), 
                linear-gradient(90deg, rgba(0, 255, 0, 0.03), rgba(0, 0, 0, 0), rgba(0, 255, 0, 0.03));
    background-size: 100% 4px, 6px 100%;
    z-index: 9998;
    pointer-events: none;
  }

  /* Dashboard Core Wrap */
  .dashboard-wrapper {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 15px 25px;
    box-sizing: border-box;
  }

  /* Micro status pulses */
  .pulsate-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 10px;
    position: relative;
  }
  .pulsate-indicator.active {
    background-color: #00FF41;
    box-shadow: 0 0 8px #00FF41;
    animation: pulse 1.8s infinite;
  }
  .pulsate-indicator.inactive {
    background-color: #FF0000;
    box-shadow: 0 0 8px #FF0000;
  }

  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.6; }
    100% { transform: scale(0.9); opacity: 1; }
  }

  /* Colors and helpers */
  .color-green { color: #00FF41; }
  .color-red { color: #FF3333; }
  .font-bold { font-weight: bold; }
  .glowing-green {
    text-shadow: 0 0 8px rgba(0, 255, 65, 0.7);
  }
  .glowing-red {
    text-shadow: 0 0 8px rgba(255, 51, 51, 0.7);
  }

  /* Header */
  .hacker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #00FF41;
    padding-bottom: 12px;
    margin-bottom: 15px;
    box-shadow: 0 4px 10px rgba(0, 255, 65, 0.08);
  }

  .hacker-header .logo-area {
    display: flex;
    align-items: center;
  }

  .hacker-header h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 2px;
    font-weight: 900;
    text-shadow: 0 0 10px rgba(0, 255, 65, 0.6);
  }

  .core-details {
    display: flex;
    gap: 20px;
  }

  .metric-node {
    font-size: 12px;
  }
  .metric-node .label {
    color: #006600;
  }

  /* Diagnostic Grid Layout */
  .diagnostic-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-gap: 15px;
    flex-grow: 1;
    min-height: 0; /* allows flex scrolling child */
  }

  /* Columns spanning definition */
  .col-4 { grid-column: span 4; }
  .col-5 { grid-column: span 5; }
  .col-7 { grid-column: span 7; }
  .col-8 { grid-column: span 8; }

  /* Cyberpunk Glass Dashboard Cards */
  .glass-panel {
    background: rgba(0, 8, 0, 0.85);
    border: 1px solid #005500;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: border 0.3s ease, box-shadow 0.3s ease;
    box-shadow: 0 0 12px rgba(0, 255, 65, 0.03);
  }
  
  .glass-panel:hover {
    border-color: #00FF41;
    box-shadow: 0 0 15px rgba(0, 255, 65, 0.15);
  }

  .panel-header {
    background-color: #002200;
    border-bottom: 1px solid #005500;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 1.5px;
    padding: 6px 12px;
    color: #00FF41;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
  }

  .panel-header .icon {
    font-size: 8px;
    animation: flash 1.5s infinite step-start;
  }

  @keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.1; }
  }

  .panel-body {
    padding: 12px 15px;
    flex-grow: 1;
    overflow-y: auto;
    box-sizing: border-box;
  }

  /* Flex row card inner style */
  .panel-body.flex-row {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 10px;
  }

  .stat-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
  }

  .stat-group.border-left {
    border-left: 1px dashed #003300;
  }

  .stat-group .label {
    font-size: 10px;
    color: #006600;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .stat-group .big-val {
    font-size: 26px;
    font-weight: bold;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .stat-group .big-val .unit {
    font-size: 13px;
    color: #006600;
  }

  .stat-group .sub-label {
    font-size: 9px;
    color: #004400;
  }

  /* Speed graph area */
  .chart-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px 15px 5px 15px;
    overflow: hidden;
  }

  .speed-svg {
    width: 100%;
    height: 100%;
    max-height: 145px;
    filter: drop-shadow(0 0 3px rgba(0, 255, 65, 0.15));
  }

  .glowing-path {
    filter: drop-shadow(0 0 4px #00FF41);
  }

  /* Horizontal lists distribution */
  .distribution-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
  }

  .dist-row {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .dist-labels {
    display: flex;
    justify-content: space-between;
    color: #009900;
  }

  .dist-labels .count {
    color: #00FF41;
  }

  .progress-bar-container {
    width: 100%;
    height: 6px;
    background-color: #001100;
    border: 1px solid #003300;
    border-radius: 1px;
  }

  .progress-bar {
    height: 100%;
    background-color: #00FF41;
    box-shadow: 0 0 6px rgba(0, 255, 65, 0.7);
    transition: width 0.5s ease;
  }

  /* Scrolling terminal log console styling */
  .console-panel .panel-body {
    background-color: #000000;
    padding: 8px;
  }

  .console-log {
    display: flex;
    flex-direction: column-reverse; /* starts at bottom */
    font-size: 11px;
  }

  .console-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .log-line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.3;
  }

  .log-line .time {
    color: #005500;
    flex-shrink: 0;
  }

  .log-line .bullet {
    color: #00FF41;
    flex-shrink: 0;
  }

  .log-line.type-info { color: #33a3ff; }
  .log-line.type-success { color: #00FF41; }
  .log-line.type-warn { color: #FFFF00; }
  .log-line.type-error { color: #FF3333; }

  /* Art list database stream table */
  .art-list-wrapper {
    padding: 0;
  }

  .art-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .art-table th {
    background-color: #001500;
    color: #007700;
    border-bottom: 1px solid #003300;
    padding: 8px 10px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .art-table td {
    padding: 8px 10px;
    border-bottom: 1px dashed #002200;
    color: #00AA00;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .art-table td.col-title {
    max-width: 160px;
  }

  .art-table tr:hover td {
    background-color: #001100;
    color: #00FF41;
  }

  /* Custom cyberpunk status badges */
  .badge {
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    text-transform: uppercase;
    font-weight: bold;
  }

  .badge-green {
    background-color: rgba(0, 255, 65, 0.15);
    border: 1px solid #00FF41;
    color: #00FF41;
  }

  .badge-blue {
    background-color: rgba(51, 163, 255, 0.15);
    border: 1px solid #33a3ff;
    color: #33a3ff;
  }

  .no-data {
    color: #004400;
    text-align: center;
    padding: 15px;
    font-style: italic;
  }
</style>
