// Generate og-image.png for UnClick social sharing
// Run: NODE_PATH=<global npm modules> node scripts/generate-og-image.cjs

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background gradient
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#0a0a0f');
bg.addColorStop(1, '#0f0f1a');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// Subtle grid lines
ctx.strokeStyle = 'rgba(255,255,255,0.03)';
ctx.lineWidth = 1;
const cols = [150, 300, 450, 600, 750, 900, 1050];
const rows = [105, 210, 315, 420, 525];
for (const x of cols) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
for (const y of rows) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

// Glow circles
const glow1 = ctx.createRadialGradient(1050, 150, 0, 1050, 150, 300);
glow1.addColorStop(0, 'rgba(99,102,241,0.10)');
glow1.addColorStop(1, 'rgba(99,102,241,0)');
ctx.fillStyle = glow1;
ctx.beginPath(); ctx.arc(1050, 150, 300, 0, Math.PI * 2); ctx.fill();

const glow2 = ctx.createRadialGradient(150, 500, 0, 150, 500, 250);
glow2.addColorStop(0, 'rgba(139,92,246,0.08)');
glow2.addColorStop(1, 'rgba(139,92,246,0)');
ctx.fillStyle = glow2;
ctx.beginPath(); ctx.arc(150, 500, 250, 0, Math.PI * 2); ctx.fill();

// Top accent bar
const accentGrad = ctx.createLinearGradient(80, 0, 200, 0);
accentGrad.addColorStop(0, '#6366f1');
accentGrad.addColorStop(1, '#8b5cf6');
ctx.fillStyle = accentGrad;
ctx.beginPath();
ctx.roundRect(80, 80, 120, 3, 2);
ctx.fill();

// "UnClick" main text
ctx.fillStyle = '#ffffff';
ctx.font = '700 96px "Courier New", ui-monospace, monospace';
ctx.letterSpacing = '-3px';
ctx.fillText('UnClick', 80, 260);

// Tagline
ctx.fillStyle = '#a0a0b0';
ctx.font = '400 32px "Courier New", ui-monospace, monospace';
ctx.letterSpacing = '0px';
ctx.fillText('Agent rails for tools, memory, and QC', 82, 320);

// Divider line
ctx.fillStyle = 'rgba(255,255,255,0.07)';
ctx.fillRect(80, 362, 1040, 1);

// Stats row
const statsY = 420;
ctx.font = '600 22px "Courier New", ui-monospace, monospace';

ctx.fillStyle = '#6366f1';
ctx.fillText('450+ endpoints', 80, statsY);

ctx.fillStyle = 'rgba(255,255,255,0.18)';
ctx.fillText('|', 270, statsY);

ctx.fillStyle = '#a0a0b0';
ctx.fillText('Pass family checks', 295, statsY);

ctx.fillStyle = 'rgba(255,255,255,0.18)';
ctx.fillText('|', 540, statsY);

ctx.fillStyle = '#a0a0b0';
ctx.fillText('Claude, ChatGPT & more', 565, statsY);

// Domain
ctx.fillStyle = 'rgba(99,102,241,0.22)';
ctx.font = '400 20px "Courier New", ui-monospace, monospace';
ctx.letterSpacing = '2px';
ctx.fillText('unclick.world', 80, 530);

// Bottom accent bar
const bottomAccent = ctx.createLinearGradient(80, 0, 160, 0);
bottomAccent.addColorStop(0, 'rgba(99,102,241,0.5)');
bottomAccent.addColorStop(1, 'rgba(139,92,246,0.5)');
ctx.fillStyle = bottomAccent;
ctx.beginPath();
ctx.roundRect(80, 547, 80, 2, 1);
ctx.fill();

// Write PNG
const outPath = path.join(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
console.log('Written:', outPath, `(${(buffer.length / 1024).toFixed(1)} KB)`);
