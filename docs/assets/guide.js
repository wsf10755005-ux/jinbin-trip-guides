(() => {
  'use strict';
  const route = document.body.dataset.route;
  const checks = [...document.querySelectorAll('[data-pack]')];
  const storageKey = `jinbin-packing-${route}`;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
  checks.forEach((box, i) => { box.checked = Array.isArray(saved) && saved.includes(i); });
  function updatePacking() {
    const selected = checks.flatMap((box, i) => box.checked ? [i] : []);
    document.querySelector('#packing-count').textContent = `已準備 ${selected.length} / ${checks.length} 項`;
    try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch {}
  }
  checks.forEach(box => box.addEventListener('change', updatePacking));
  document.querySelector('#packing-reset').addEventListener('click', () => { checks.forEach(box => { box.checked = false; }); updatePacking(); });
  updatePacking();

  class TripSoundscape {
    constructor(kind) { this.kind = kind; this.enabled = false; this.volume = .15; this.whistleCount = 0; this.nextWhistleAt = Infinity; this.timer = null; }
    init() {
      if (this.ctx) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('unsupported');
      this.ctx = new Audio();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -18; limiter.knee.value = 18; limiter.ratio.value = 6;
      this.master.connect(limiter); limiter.connect(this.ctx.destination);
      // Procedural soundscapes: no external recording, tracking, or audio download.
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      this.noise = buffer;
      this.noiseLayer(this.kind === 'r01' ? 210 : 650, this.kind === 'r01' ? 1.2 : .6);
      if (this.kind === 'r02') this.noiseLayer(2100, .18, 'bandpass');
    }
    noiseLayer(frequency, gain, type = 'lowpass') {
      const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), level = this.ctx.createGain();
      source.buffer = this.noise; source.loop = true; filter.type = type; filter.frequency.value = frequency;
      level.gain.value = gain; source.connect(filter); filter.connect(level); level.connect(this.master); source.start();
    }
    pulse(frequency, time, duration, volume, type = 'sine') {
      const oscillator = this.ctx.createOscillator(), gain = this.ctx.createGain();
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + Math.min(.06, duration / 4));
      gain.gain.setValueAtTime(volume, time + duration * .6); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(time); oscillator.stop(time + duration + .03);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    whistle() {
      const now = this.ctx.currentTime;
      [392, 494, 587].forEach(f => this.pulse(f, now, 1.65, .13, 'triangle'));
      this.whistleCount++;
    }
    tick() {
      if (!this.enabled || this.ctx.state !== 'running' || document.hidden) return;
      const now = this.ctx.currentTime;
      if (this.kind === 'r01') {
        // Paired wheel/rail impacts, softened by short envelopes.
        for (const offset of [0, .13]) this.pulse(80, now + offset, .09, .20, 'triangle');
        if (performance.now() >= this.nextWhistleAt) { this.whistle(); this.nextWhistleAt = performance.now() + 150000; }
      } else if (performance.now() >= this.nextChirpAt) {
        const base = 3300 + Math.random() * 700;
        for (let i = 0; i < 5; i++) this.pulse(base, now + i * .13, .07, .035);
        this.nextChirpAt = performance.now() + 1800 + Math.random() * 2500;
      }
    }
    async start(automatic = false) {
      this.init();
      if (automatic && this.ctx.state !== 'running') return false;
      if (this.ctx.state !== 'running') await this.ctx.resume();
      if (this.ctx.state !== 'running') return false;
      if (this.enabled) return true;
      this.enabled = true;
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .25);
      this.nextChirpAt = performance.now() + 800;
      if (this.kind === 'r01') { this.whistle(); this.nextWhistleAt = performance.now() + 150000; }
      clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 480);
      return true;
    }
    async stop() {
      this.enabled = false; clearInterval(this.timer); this.timer = null;
      if (this.ctx) { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setValueAtTime(0, this.ctx.currentTime); await this.ctx.suspend(); }
    }
    setVolume(value) { this.volume = Math.min(.6, Math.max(0, value)); if (this.ctx && this.enabled) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .06); }
    async dispose() { this.enabled = false; clearInterval(this.timer); this.timer = null; if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close(); }
  }
  const quick = document.querySelector('#quick-sound');
  const sound = new TripSoundscape(route), toggle = document.querySelector('#sound-toggle'), status = document.querySelector('#sound-status');
  window.jinbinSound = sound;
  function renderSound() { quick.textContent = sound.enabled ? '聲音：開' : '聲音：關'; quick.setAttribute('aria-pressed', String(sound.enabled)); toggle.textContent = sound.enabled ? '關閉旅程聲音' : '開啟旅程聲音'; toggle.setAttribute('aria-pressed', String(sound.enabled)); status.textContent = sound.enabled ? '聲音已開啟・合成環境聲景' : '點一下開啟聲音，也可以安靜閱讀。'; }
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try { if (sound.enabled) await sound.stop(); else await sound.start(); renderSound(); }
    catch { status.textContent = '此瀏覽器暫時無法播放，仍可正常閱讀攻略。'; }
    finally { toggle.disabled = false; }
  });
  quick.addEventListener('click', () => toggle.click());
  document.querySelector('#volume').addEventListener('input', e => sound.setVolume(Number(e.target.value) / 100 * .6));
  document.addEventListener('visibilitychange', async () => {
    if (!sound.ctx || !sound.enabled) return;
    if (document.hidden) { await sound.ctx.suspend(); status.textContent = '離開頁面期間暫停聲音'; }
    else { try { await sound.ctx.resume(); renderSound(); } catch { await sound.stop(); renderSound(); } }
  });
  window.addEventListener('pagehide', () => { void sound.dispose(); });
  // Try automatic playback only if browser policy permits it; never pretend it started.
  void sound.start(true).then(renderSound).catch(() => { status.textContent = '點一下開啟聲音，也可以安靜閱讀。'; });
})();
