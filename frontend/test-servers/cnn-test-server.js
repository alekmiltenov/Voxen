#!/usr/bin/env node
/**
 * CNN Test Server
 * Simulates nn_server.py for testing the frontend without actual hardware
 * 
 * Usage: node cnn-test-server.js
 * Then open http://localhost:8000 in browser to control the fake CNN predictions
 * 
 * The frontend will connect to ws://localhost:8000/ws/predict and receive simulated data
 */

import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8001;

// Create HTTP server for camera stream and control UI
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    // Serve control UI
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getControlUI());
  } else if (req.url === '/camera/stream') {
    // Serve fake camera stream (black image)
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c285037393832323020ac0102090b0c0c0cac000001010e0d0e0cac000000ffdd00040012ffc000110800010001011100021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d010203002104051112131415061671322328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3334353637383939a242434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f01000301010101010101010101010100000000000102030405060708090a0bffc400b51101020202040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00f5740055405540055401540054ffd9'));
  } else if (req.method === 'POST' && req.url === '/api/gaze') {
    // Handle control API commands
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        const cmd = JSON.parse(data);
        currentGaze = cmd.gaze || 'CENTER';
        currentConfidence = cmd.confidence !== undefined ? cmd.confidence : 0.95;
        holdingDirection = cmd.hold ? currentGaze : null;
        holdStartTime = cmd.hold ? Date.now() : null;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, gaze: currentGaze, confidence: currentConfidence }));
        
        // Broadcast to all connected clients
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // WebSocket.OPEN = 1
            client.send(JSON.stringify({ 
              ready: true, 
              name: currentGaze, 
              confidence: currentConfidence 
            }));
          }
        });
      } catch (e) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws/predict' });

let currentGaze = 'CENTER';
let currentConfidence = 0.95;
let holdingDirection = null;
let holdStartTime = null;

wss.on('connection', (ws) => {
  console.log('✓ Frontend connected to test CNN server');
  
  // Send ready signal immediately
  ws.send(JSON.stringify({ ready: true, name: currentGaze, confidence: currentConfidence }));

  // Broadcast current state every 100ms (like real nn_server)
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ 
        ready: true, 
        name: currentGaze, 
        confidence: currentConfidence 
      }));
    }
  }, 100);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('✗ Frontend disconnected');
  });
});

function getControlUI() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CNN Test Controller</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f0f0f;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 30px;
      text-align: center;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .section {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 16px;
    }
    .gaze-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    button {
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    button.active {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.5);
      color: #86efac;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.3);
    }
    .controls {
      display: flex;
      gap: 12px;
      margin-top: 16px;
    }
    .controls button {
      flex: 1;
    }
    .slider-row {
      margin-bottom: 16px;
    }
    .slider-label {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    input[type="range"] {
      width: 100%;
      cursor: pointer;
      accent-color: #22c55e;
    }
    .status {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      font-size: 13px;
    }
    .status-label {
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 4px;
    }
    .status-value {
      font-size: 18px;
      font-weight: 600;
      color: #86efac;
      font-family: monospace;
    }
    .instructions {
      background: rgba(255, 255, 255, 0.03);
      border-left: 2px solid rgba(34, 197, 94, 0.5);
      padding: 12px 16px;
      border-radius: 4px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>CNN Test Controller</h1>

    <div class="section">
      <div class="section-title">Simulate Gaze Direction</div>
      <div class="gaze-grid">
        <button></button>
        <button class="gaze-btn" data-gaze="UP">↑ UP</button>
        <button></button>
        <button class="gaze-btn" data-gaze="LEFT">← LEFT</button>
        <button class="gaze-btn active" data-gaze="CENTER">● CENTER</button>
        <button class="gaze-btn" data-gaze="RIGHT">RIGHT →</button>
        <button></button>
        <button class="gaze-btn" data-gaze="DOWN">↓ DOWN</button>
        <button></button>
      </div>
      <button class="gaze-btn" data-gaze="CLOSED" style="width: 100%; grid-column: 1 / -1;">😴 CLOSED (eyes closed)</button>
    </div>

    <div class="section">
      <div class="section-title">Confidence Level</div>
      <div class="slider-row">
        <div class="slider-label">
          <span>Confidence</span>
          <span id="confidence-value">0.95</span>
        </div>
        <input type="range" id="confidence" min="0" max="1" step="0.05" value="0.95">
      </div>
    </div>

    <div class="section">
      <div class="section-title">Hold Direction (for testing dwell)</div>
      <div class="controls">
        <button id="hold-btn" style="flex: 1;">Start Holding</button>
        <button id="release-btn" style="flex: 1; opacity: 0.5; cursor: not-allowed;" disabled>Release</button>
      </div>
    </div>

    <div class="section">
      <div class="status">
        <div class="status-label">Current Signal</div>
        <div class="status-value" id="current-gaze">CENTER</div>
      </div>
    </div>

    <div class="section">
      <div class="instructions">
        <strong>How to test:</strong><br>
        1. Frontend should show "Connected to nn_server.py" in CNN Settings<br>
        2. Click directions to simulate gaze<br>
        3. Use "Hold" to test dwell timers (selection duration)<br>
        4. Adjust confidence to test threshold (default: 0.95)
      </div>
    </div>
  </div>

  <script>
    let currentGaze = 'CENTER';
    let currentConfidence = 0.95;
    let isHolding = false;

    const gazeBtns = document.querySelectorAll('.gaze-btn');
    const confidenceSlider = document.getElementById('confidence');
    const confidenceValue = document.getElementById('confidence-value');
    const holdBtn = document.getElementById('hold-btn');
    const releaseBtn = document.getElementById('release-btn');
    const currentGazeDisplay = document.getElementById('current-gaze');

    // Gaze buttons
    gazeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const gaze = btn.dataset.gaze;
        currentGaze = gaze;
        updateUI();
        sendCommand({ gaze, confidence: currentConfidence, hold: false });
      });
    });

    // Confidence slider
    confidenceSlider.addEventListener('input', (e) => {
      currentConfidence = parseFloat(e.target.value);
      confidenceValue.textContent = currentConfidence.toFixed(2);
      sendCommand({ gaze: currentGaze, confidence: currentConfidence, hold: isHolding });
    });

    // Hold button
    holdBtn.addEventListener('click', () => {
      isHolding = true;
      updateUI();
      sendCommand({ gaze: currentGaze, confidence: currentConfidence, hold: true });
    });

    // Release button
    releaseBtn.addEventListener('click', () => {
      isHolding = false;
      updateUI();
      sendCommand({ gaze: currentGaze, confidence: currentConfidence, hold: false });
    });

    function updateUI() {
      gazeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gaze === currentGaze);
      });
      holdBtn.disabled = isHolding;
      holdBtn.style.opacity = isHolding ? '0.5' : '1';
      holdBtn.style.cursor = isHolding ? 'not-allowed' : 'pointer';
      
      releaseBtn.disabled = !isHolding;
      releaseBtn.style.opacity = !isHolding ? '0.5' : '1';
      releaseBtn.style.cursor = !isHolding ? 'not-allowed' : 'pointer';
      
      currentGazeDisplay.textContent = currentGaze + (isHolding ? ' (holding)' : '');
    }

    function sendCommand(data) {
      fetch('/api/gaze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(err => console.error('Error:', err));
    }

    updateUI();
  </script>
</body>
</html>
`;
}

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         CNN TEST SERVER - Ready for Testing                   ║
╠════════════════════════════════════════════════════════════════╣
║ 🧪 Control UI:   http://localhost:${PORT}                       ║
║ 📡 WebSocket:    ws://localhost:${PORT}/ws/predict             ║
║ 📷 Camera:       http://localhost:${PORT}/camera/stream        ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Frontend connects to ws://localhost:8000/ws/predict         ║
║ 2. Open http://localhost:8000 in a browser                    ║
║ 3. Click buttons to simulate CNN predictions                  ║
║ 4. Test dwell timers with "Hold" button                       ║
╚════════════════════════════════════════════════════════════════╝
  `);
});
