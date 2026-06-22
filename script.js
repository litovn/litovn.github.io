(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };

  // ---- Elements ----
  var site = $("#site");
  var muteBtn = $("#muteBtn");
  var confettiBtn = $("#confettiBtn");
  var visitorCount = $("#visitorCount");

  // ---- Visitor counter (global, shared across all visitors) ----
  // GitHub Pages serves static files only, so a true global count needs an
  // external store. We use Abacus (https://jasoncameron.dev/abacus/), a free,
  // no-signup, CORS-enabled hit counter (the successor to CountAPI). It
  // auto-creates the counter on the first hit and returns { "value": N }.
  // If the request fails (offline, blocked, rate-limited) we fall back to a
  // per-device count so the badge still shows something.
  var COUNTER_NS = "litovn.github.io"; // namespace = your domain
  var COUNTER_KEY = "visits";

  function renderVictim(n) {
    visitorCount.textContent = "#" + String(n).padStart(6, "0");
  }

  fetch("https://abacus.jasoncameron.dev/hit/" + COUNTER_NS + "/" + COUNTER_KEY)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || typeof data.value !== "number") throw new Error("bad response");
      renderVictim(data.value);
    })
    .catch(function () {
      var local = parseInt(localStorage.getItem("nikitad_count") || "0", 10) + 1;
      localStorage.setItem("nikitad_count", String(local));
      renderVictim(local);
    });

  // ---- Confetti engine (self-contained canvas) ----
  var canvas = $("#confetti");
  var ctx = canvas.getContext("2d");
  var particles = [];
  var rafId = null;
  var COLORS = ["#cf82ff", "#6c8cff", "#720ab3", "#ffd166", "#ff6b6b", "#06d6a0", "#ffffff"];

  function sizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);

  function burst(amount) {
    amount = amount || 140;
    for (var i = 0; i < amount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        size: 5 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() < 0.5 ? "rect" : "circle"
      });
    }
    if (!rafId) loop();
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += 0.08; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (p.y > canvas.height + 30) particles.splice(i, 1);
    }
    if (particles.length) {
      rafId = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = null;
    }
  }

  // ---- Sound (Web Audio API, no files needed) ----
  var audioCtx = null;
  var masterGain = null;
  var muted = false;

  function initAudio() {
    if (audioCtx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);
  }

  function airhorn() {
    if (!audioCtx || muted) return;
    var t = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(220, t + 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
    g.gain.setValueAtTime(0.4, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.72);
  }

  function chime() {
    if (!audioCtx || muted) return;
    var notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach(function (f, i) {
      var t = audioCtx.currentTime + 0.6 + i * 0.12;
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  function celebrate() {
    burst(160);
    airhorn();
    chime();
  }

  muteBtn.addEventListener("click", function () {
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    muteBtn.textContent = muted ? "\uD83D\uDD07" : "\uD83D\uDD0A";
  });

  // ---- Opening sound (best-effort; browsers may block autoplay until a gesture) ----
  var openingPlayed = false;
  function playOpeningSound() {
    if (openingPlayed || !audioCtx || muted) return;
    if (audioCtx.state !== "running") return;
    openingPlayed = true;
    airhorn();
    chime();
  }

  // If autoplay is blocked, play the opening sound on the first user interaction instead.
  function unlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().then(playOpeningSound);
    } else {
      playOpeningSound();
    }
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  }
  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", unlockAudio);

  // ---- Buttons ----
  confettiBtn.addEventListener("click", celebrate);

  // ---- Reveal the site on page load (confetti always; try sound immediately) ----
  site.removeAttribute("hidden");
  burst(160);
  initAudio();
  if (audioCtx) {
    audioCtx.resume().then(playOpeningSound).catch(function () {});
  }
})();
