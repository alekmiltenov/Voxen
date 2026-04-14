#!/usr/bin/env node
import { WebSocketServer } from 'ws';

const PORT = 8003;
const PATH = '/ws/head';
const TICK_MS = 33; // ~30Hz
const ENABLE_NOISE = true;
const NOISE_AMPLITUDE = 0.02;

const wss = new WebSocketServer({ port: PORT, path: PATH });
let current = { x: 0, y: 0 };
let currentDirection = 'CENTER';

const noise = () => (Math.random() * 2 - 1) * NOISE_AMPLITUDE;

function setDirection(name, x, y) {
  current = { x, y };
  if (name !== currentDirection) {
    currentDirection = name;
    console.log(`[HEAD SIM] ${currentDirection}`);
  }
}

function getSimulatedReading(now) {
  let x = current.x;
  let y = current.y;

  if (ENABLE_NOISE) {
    x += noise();
    y += noise();
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    z: 1.0,
    timestamp: now,
  };
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

setInterval(() => {
  broadcast(getSimulatedReading(Date.now()));
}, TICK_MS);

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on('data', (key) => {
  const k = key.toString().toLowerCase();

  if (k === '\u0003') process.exit(); // ctrl+c

  if (k === 'a') setDirection('LEFT', -0.7, 0);
  if (k === 'd') setDirection('RIGHT', 0.7, 0);
  if (k === 'w') setDirection('UP', 0, -0.6);
  if (k === 's') setDirection('DOWN', 0, 0.6);
  if (k === ' ') setDirection('CENTER', 0, 0);
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(getSimulatedReading(Date.now())));
  console.log(`[HEAD SIM] Client connected (${wss.clients.size} total)`);
  ws.on('close', () => console.log(`[HEAD SIM] Client disconnected (${wss.clients.size} total)`));
});

console.log(`[HEAD SIM] WebSocket server running on ws://localhost:${PORT}${PATH}`);
console.log('[HEAD SIM] Streaming accelerometer data (x, y, z, timestamp) at ~30Hz');
console.log('[HEAD SIM] Controls: A=LEFT D=RIGHT W=UP S=DOWN SPACE=CENTER Ctrl+C=exit');
