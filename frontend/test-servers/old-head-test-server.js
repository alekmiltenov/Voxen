#!/usr/bin/env node
/**
 * OLD AND BAD TEST SERVER SIMULATING COMANDS INSTEAD OF RAW ACCEL DATA!!!
 * HEAD Test Server
 * Simulates ESP32 accelerometer for testing head control without hardware
 * 
 * Usage: node head-test-server.js
 * Then open http://localhost:8002 in browser to control fake accelerometer data
 * 
 * The backend receives HTTP POST at /head/data with x,y,z values
 * Frontend connects to WebSocket /ws/head to receive commands
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8002;
const BACKEND_URL = 'http://10.237.97.128:5000'; // Backend address

let currentX = 0.0;
let currentY = 0.0;
let currentZ = 9.8; // Resting gravity
let lastResponse = null;
let wsClients = new Set(); // Track connected WebSocket clients

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getControlUI());
  } else if (req.method === 'POST' && req.url === '/api/accel') {
    // Control endpoint - simulate accelerometer changes
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        const cmd = JSON.parse(data);
        currentX = cmd.x !== undefined ? cmd.x : currentX;
        currentY = cmd.y !== undefined ? cmd.y : currentY;
        currentZ = cmd.z !== undefined ? cmd.z : currentZ;

        console.log(`[HEAD UI] Received: x=${currentX.toFixed(2)}, y=${currentY.toFixed(2)}, z=${currentZ.toFixed(2)}`);

        // Send to backend (async, don't wait)
        sendToBackend();

        // Send immediate response to UI with current values
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ok: true, 
          x: currentX, 
          y: currentY, 
          z: currentZ,
          cmd: lastResponse?.cmd || null
        }));
      } catch (e) {
        console.error(`[HEAD UI] Parse error:`, e.message);
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

function sendToBackend() {
  const payload = JSON.stringify({ x: currentX, y: currentY, z: currentZ });
  
  // Simulate command based on accelerometer values (for dev/test mode)
  let simulatedCmd = null;
  const threshold = 1.5;
  
  if (currentX < -threshold) simulatedCmd = 'LEFT';
  else if (currentX > threshold) simulatedCmd = 'RIGHT';
  else if (currentY < -threshold) simulatedCmd = 'BACK';
  else if (currentY > threshold) simulatedCmd = 'FORWARD';
  
  // Try to send to backend (will timeout but that's ok in dev mode)
  const reqOptions = {
    hostname: new URL(BACKEND_URL).hostname,
    port: new URL(BACKEND_URL).port || 5000,
    path: '/head/data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
    timeout: 1000, // 1 second timeout
  };

  const backendReq = http.request(reqOptions, (res) => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      try {
        lastResponse = JSON.parse(body);
        console.log(`[HEAD] → backend: x=${currentX.toFixed(2)}, y=${currentY.toFixed(2)}, cmd=${lastResponse.cmd || 'null'}`);
      } catch (e) {
        lastResponse = { cmd: simulatedCmd, x: currentX, y: currentY, z: currentZ };
      }
    });
  });

  backendReq.on('error', (e) => {
    // Fallback to simulated command when backend unavailable (dev mode)
    lastResponse = { cmd: simulatedCmd, x: currentX, y: currentY, z: currentZ };
    console.log(`[HEAD] Simulated: x=${currentX.toFixed(2)}, y=${currentY.toFixed(2)}, cmd=${simulatedCmd || 'null'}`);
  });

  backendReq.on('timeout', () => {
    backendReq.destroy();
  });

  backendReq.write(payload);
  backendReq.end();
}

// Create WebSocket server with noServer to handle upgrade manually
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log(`[HEAD WS] Frontend connected, total clients: ${wss.clients.size}`);
  wsClients.add(ws);
  
  // Send initial state
  ws.send(JSON.stringify({
    cmd: lastResponse?.cmd || null,
    x: currentX,
    y: currentY,
    z: currentZ,
  }));
  
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`[HEAD WS] Frontend disconnected, remaining clients: ${wss.clients.size}`);
  });
  
  ws.on('error', (err) => {
    console.error(`[HEAD WS] Error: ${err.message}`);
  });
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/head') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Broadcast accelerometer state every 100ms
setInterval(() => {
  if (wss.clients.size > 0) {
    const msg = JSON.stringify({
      cmd: lastResponse?.cmd || null,
      x: currentX,
      y: currentY,
      z: currentZ,
    });
    
    wss.clients.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(msg);
      }
    });
  }
}, 100);

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         HEAD TEST SERVER - Ready for Testing                  ║
╠════════════════════════════════════════════════════════════════╣
║ 🧭 Control UI:   http://localhost:${PORT}                        ║
║ 📡 Backend:      ${BACKEND_URL}          ║
║ 🔌 WebSocket:    ws://localhost:${PORT}/ws/head                  ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Frontend connects to WebSocket /ws/head                     ║
║ 2. Open http://localhost:${PORT} in browser                     ║
║ 3. Click buttons to simulate head tilts                        ║
║ 4. Watch backend commands (LEFT/RIGHT/FORWARD/BACK)           ║
║ 5. Frontend receives updates via WebSocket                     ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

function getControlUI() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HEAD Test Controller</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    h1 {
      text-align: center;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 30px;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .grid-3x2 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    button {
      padding: 15px;
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      background: rgba(31, 41, 55, 0.8);
      color: #fff;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    button:hover {
      background: rgba(59, 130, 246, 0.3);
      border-color: rgba(59, 130, 246, 0.6);
    }
    button:active {
      background: rgba(59, 130, 246, 0.5);
      transform: scale(0.98);
    }
    .slider-group {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
    }
    .slider-label {
      min-width: 60px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 600;
    }
    input[type="range"] {
      flex: 1;
      height: 6px;
      cursor: pointer;
    }
    .slider-value {
      min-width: 50px;
      text-align: right;
      font-weight: 600;
      font-size: 13px;
    }
    .reset-btn {
      width: 100%;
      padding: 12px;
      background: rgba(107, 114, 128, 0.3);
      border-color: rgba(107, 114, 128, 0.5);
      margin-top: 10px;
    }
    .reset-btn:hover {
      background: rgba(107, 114, 128, 0.5);
    }
    .status {
      background: rgba(31, 41, 55, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
    }
    .status-label {
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 8px;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 1px;
    }
    .status-value {
      color: #60a5fa;
      word-break: break-all;
    }
    .value-row {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧭 HEAD Test</h1>
    <p class="subtitle">Simulate accelerometer tilts</p>

    <!-- Direction Grid -->
    <div class="section">
      <div class="section-title">Tilt Directions</div>
      <div class="grid-3x2">
        <div></div>
        <button onclick="tilt('up')">↑ UP<br>(FORWARD)</button>
        <div></div>
        
        <button onclick="tilt('left')">← LEFT</button>
        <button onclick="tilt('center')">Center</button>
        <button onclick="tilt('right')">RIGHT →</button>
        
        <div></div>
        <button onclick="tilt('down')">↓ DOWN<br>(BACK)</button>
        <div></div>
      </div>
    </div>

    <!-- Manual Control -->
    <div class="section">
      <div class="section-title">Manual Values</div>
      <div class="slider-group">
        <label class="slider-label">X (Roll)</label>
        <input type="range" id="sliderX" min="-5" max="5" step="0.1" value="0" oninput="updateValues()">
        <span class="slider-value" id="valX">0.0</span>
      </div>
      <div class="slider-group">
        <label class="slider-label">Y (Pitch)</label>
        <input type="range" id="sliderY" min="-5" max="5" step="0.1" value="0" oninput="updateValues()">
        <span class="slider-value" id="valY">0.0</span>
      </div>
      <div class="slider-group">
        <label class="slider-label">Z (Grav)</label>
        <input type="range" id="sliderZ" min="0" max="12" step="0.1" value="9.8" oninput="updateValues()">
        <span class="slider-value" id="valZ">9.8</span>
      </div>
      <button class="reset-btn" onclick="reset()">Reset to Center</button>
    </div>

    <!-- Status -->
    <div class="status">
      <div class="status-label">Backend Response</div>
      <div class="status-value" id="response">Waiting for first input...</div>
    </div>
  </div>

  <script>
    const backend = '${BACKEND_URL}';

    async function send(x, y, z) {
      try {
        const res = await fetch('http://localhost:${PORT}/api/accel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y, z }),
        });
        const data = await res.json();
        updateDisplay(data);
      } catch (e) {
        document.getElementById('response').innerHTML = '❌ Error: ' + e.message;
      }
    }

    function updateDisplay(data) {
      const res = data.lastResponse || {};
      const cmd = res.cmd || 'null';
      const cmdColor = cmd === 'null' ? '⚪' : cmd === 'LEFT' ? '🔵' : cmd === 'RIGHT' ? '🟢' : cmd === 'FORWARD' ? '🟡' : '🔴';
      document.getElementById('response').innerHTML = \`
        <div class="value-row">\${cmdColor} cmd: <strong>\${cmd}</strong></div>
        <div class="value-row">x: \${res.x?.toFixed(3) || '—'}</div>
        <div class="value-row">y: \${res.y?.toFixed(3) || '—'}</div>
        <div class="value-row">z: \${res.z?.toFixed(3) || '—'}</div>
      \`;
    }

    function tilt(dir) {
      let x = 0, y = 0, z = 9.8;
      if (dir === 'left') x = -2.5;
      if (dir === 'right') x = 2.5;
      if (dir === 'up') y = 2.5;
      if (dir === 'down') y = -2.5;
      
      document.getElementById('sliderX').value = x;
      document.getElementById('sliderY').value = y;
      document.getElementById('sliderZ').value = z;
      updateValues();
    }

    function updateValues() {
      const x = parseFloat(document.getElementById('sliderX').value);
      const y = parseFloat(document.getElementById('sliderY').value);
      const z = parseFloat(document.getElementById('sliderZ').value);
      
      document.getElementById('valX').textContent = x.toFixed(1);
      document.getElementById('valY').textContent = y.toFixed(1);
      document.getElementById('valZ').textContent = z.toFixed(1);
      
      send(x, y, z);
    }

    function reset() {
      document.getElementById('sliderX').value = 0;
      document.getElementById('sliderY').value = 0;
      document.getElementById('sliderZ').value = 9.8;
      updateValues();
    }
  </script>
</body>
</html>
  `;
}
