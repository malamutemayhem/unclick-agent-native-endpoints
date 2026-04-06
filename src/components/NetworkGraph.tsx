import { useEffect, useRef } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connected: boolean;
}

interface Pulse {
  fromIndex: number;
  toIndex: number;
  progress: number;
  speed: number;
}

const NetworkGraph = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;
    const nodes: Node[] = [];
    const pulses: Pulse[] = [];
    const CONNECTION_DIST = 180;
    const NODE_COUNT = 35;

    const resize = () => {
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    const init = () => {
      resize();
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 1,
          connected: false,
        });
      }
    };

    const spawnPulse = () => {
      if (pulses.length > 5) return;
      const i = Math.floor(Math.random() * nodes.length);
      let closest = -1;
      let closestDist = CONNECTION_DIST;
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) {
          closestDist = d;
          closest = j;
        }
      }
      if (closest >= 0) {
        pulses.push({ fromIndex: i, toIndex: closest, progress: 0, speed: 0.015 + Math.random() * 0.01 });
      }
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Move nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.connected = false;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECTION_DIST) {
            const alpha = (1 - d / CONNECTION_DIST) * 0.15;
            ctx.strokeStyle = `rgba(226, 185, 59, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
            nodes[i].connected = true;
            nodes[j].connected = true;
          }
        }
      }

      // Draw pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.progress += p.speed;
        if (p.progress > 1) {
          pulses.splice(i, 1);
          continue;
        }
        const from = nodes[p.fromIndex];
        const to = nodes[p.toIndex];
        const x = from.x + (to.x - from.x) * p.progress;
        const y = from.y + (to.y - from.y) * p.progress;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 6);
        glow.addColorStop(0, `rgba(226, 185, 59, 0.8)`);
        glow.addColorStop(1, `rgba(226, 185, 59, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw nodes
      for (const n of nodes) {
        const alpha = n.connected ? 0.6 : 0.2;
        ctx.fillStyle = `rgba(226, 185, 59, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (Math.random() < 0.03) spawnPulse();
      animationId = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-40"
    />
  );
};

export default NetworkGraph;
