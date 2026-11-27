/**
 * Liquid Navbar "Waterline" - vanilla JS port (no React, no build step).
 * Port of Nimbus UI liquid-glass-navbar.tsx (guglielmogiannattasio.it).
 * Water is drawn by a small WebGL shader inside the pill (paused off-screen);
 * without WebGL it falls back to a CSS drop. Styles live in styles.css (.nimbus-*).
 *
 *   const nav = LiquidNav.mount(hostEl, { items:[{label,icon,fx}], tone:'light', onChange(i,item){} });
 *   nav.setActive(2); nav.setLabels([...]); nav.destroy();
 */
(function () {
  'use strict';
  const PAD = 14; // canvas bleed around the pill, for shadows and ripples
  const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
  const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

  const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const SHIELD = '<path d="M12 3.2 5 6v5.6c0 4.4 2.9 7.6 7 9.2 4.1-1.6 7-4.8 7-9.2V6l-7-2.8Z"/>';
  const ICONS = {
    home: svg('<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M6 9.6V20h12V9.6"/><path class="nv-door" d="M10 20v-5h4v5Z"/>'),
    globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/>'),
    plane: svg('<path d="M21 12.2 3.6 5.4l2.7 6.8-2.7 6.4L21 12.2Zm-14.7 0H13"/>'),
    drop: svg('<path d="M12 3.5s6 6.4 6 10.6a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5Z"/>'),
    user: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c1.2-3.4 4-5 7.2-5s6 1.6 7.2 5"/>'),
    shield: svg(SHIELD + '<path d="m8.8 12.2 2.3 2.3 4.2-4.6"/>'),
    badge: svg(SHIELD + '<circle cx="12" cy="10" r="2.3"/><path d="M8.3 16.3c.9-1.6 2.1-2.3 3.7-2.3s2.8.7 3.7 2.3"/>')
  };

  function makeState() {
    return {
      a: { x: 0, v: 0 }, b: { x: 0, v: 0 }, sy: { s: 1, v: 0 }, lead: 0, lagFrom: 0,
      sats: [], rips: [], t: { x: 0, cy: 0, q: 0, r: 21 }, q: 0,
      mouse: { x: 0, y: 0, s: 0, on: false }, moving: false, split: false, ready: false,
      w: 0, h: 0, visible: true, reduce: false, raf: 0, last: 0, time: 0, glc: null
    };
  }

  function initGL(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    const compile = (type, code) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, code); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {};
    for (const n of ['uRes', 'uDpr', 'uTime', 'uPill', 'uBlob', 'uSy', 'uRip', 'uMouse', 'uDark', 'uAmb']) u[n] = gl.getUniformLocation(p, n);
    return { gl, u };
  }

  function supportsRefraction() {
    if (typeof CSS === 'undefined' || !CSS.supports) return false;
    const ua = navigator.userAgent;
    return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua) && CSS.supports('backdrop-filter', 'url(#a)');
  }

  function mount(host, opts) {
    opts = opts || {};
    const items = opts.items || [];
    const tone = opts.tone === 'dark' ? 'dark' : 'light';
    const onChange = opts.onChange;
    let current = opts.defaultActive || 0;
    const s = makeState();
    const reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    s.reduce = !!(reduceQuery && reduceQuery.matches);

    const nav = document.createElement('nav');
    nav.className = 'nimbus-nav';
    nav.dataset.tone = tone; nav.dataset.gl = 'on';
    nav.dataset.refract = supportsRefraction() ? 'on' : 'off';
    nav.setAttribute('aria-label', opts.ariaLabel || 'Main');
    nav.innerHTML =
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="nimbus-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="2" seed="7" result="noise"/><feGaussianBlur in="noise" stdDeviation="2" result="soft"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="soft" scale="60" xChannelSelector="R" yChannelSelector="G"/></filter></svg>' +
      '<span class="nimbus-glass" aria-hidden="true"></span><canvas class="nimbus-water" aria-hidden="true"></canvas><span class="nimbus-drop" aria-hidden="true"></span>';
    const canvas = nav.querySelector('canvas');
    const dropEl = nav.querySelector('.nimbus-drop');
    const els = [], icos = [];
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nimbus-item'; b.title = it.label; b.setAttribute('aria-label', it.label);
      b.innerHTML = '<span class="nv-ico"></span><span class="nimbus-label"></span>';
      b.querySelector('.nv-ico').innerHTML = it.icon || '';
      b.querySelector('.nimbus-label').textContent = it.label;
      b.addEventListener('click', () => select(i));
      nav.appendChild(b); els.push(b); icos.push(b.querySelector('.nv-ico'));
    });
    host.replaceChildren(nav);
    const paintCurrent = () => els.forEach((b, i) => (i === current ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    paintCurrent();

    /* ---- drawing ---- */
    function draw() {
      const T = s.t;
      const sep = Math.abs(s.a.x - s.b.x);
      const thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1);
      const r = T.r * (1 - 0.3 * thin);
      if (s.glc) {
        const g = s.glc.gl, u = s.glc.u;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
        g.uniform2f(u.uRes, s.w + PAD * 2, s.h + PAD * 2);
        g.uniform1f(u.uDpr, dpr);
        g.uniform1f(u.uTime, s.time);
        g.uniform4f(u.uPill, PAD, PAD, s.w, s.h);
        const blobs = new Float32Array(24), sy = new Float32Array(6).fill(1);
        const head = s.lead === 0 ? s.a : s.b, tail = s.lead === 0 ? s.b : s.a;
        blobs.set([head.x, T.cy, s.q * (1 - 0.25 * thin), T.r * (1 - 0.12 * thin), tail.x, T.cy, s.q * (1 - 0.8 * thin), T.r * (1 - 0.5 * thin)], 0);
        sy[0] = sy[1] = s.sy.s;
        s.sats.slice(0, 4).forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4));
        g.uniform4fv(u.uBlob, blobs); g.uniform1fv(u.uSy, sy);
        const rips = new Float32Array(24);
        s.rips.slice(-6).forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
        g.uniform4fv(u.uRip, rips);
        g.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
        g.uniform1f(u.uDark, tone === 'dark' ? 1 : 0);
        g.uniform1f(u.uAmb, s.reduce ? 0 : 1);
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
        g.drawArrays(g.TRIANGLES, 0, 3);
      } else {
        const left = Math.min(s.a.x, s.b.x) - s.q - r - PAD;
        dropEl.style.width = (sep + 2 * (s.q + r)) + 'px';
        dropEl.style.transform = 'translateX(' + left + 'px) scaleY(' + s.sy.s + ')';
      }
    }

    /* ---- physics ---- */
    function step(dt, now) {
      const T = s.t;
      s.time += dt;
      s.q += (T.q - s.q) * Math.min(1, dt * 12);
      const bodies = [s.a, s.b];
      let still = true;
      if (s.reduce) {
        s.a.x = s.b.x = T.x; s.a.v = s.b.v = 0; s.sy.s = 1; s.sats = [];
      } else {
        bodies.forEach((B, i) => {
          const lead = i === s.lead, k = lead ? 210 : 72, c = lead ? 25 : 13;
          const f = !lead && now < s.lagFrom ? 0.08 : 1;
          B.v += (k * (T.x - B.x) - c * B.v) * dt * f;
          B.x += B.v * dt;
          const lo = PAD + 6 + s.q + T.r - 3, hi = PAD + s.w - 6 - s.q - T.r + 3;
          if (B.x < lo || B.x > hi) {
            s.sy.v -= Math.min(Math.abs(B.v), 900) * 0.0016;
            B.x = Math.max(lo, Math.min(hi, B.x));
            B.v *= -0.25;
          }
          if (Math.abs(T.x - B.x) > 0.3 || Math.abs(B.v) > 3) still = false;
        });
        const L = bodies[s.lead];
        const syT = 1 - 0.2 * Math.min(Math.abs(L.v) / 1500, 1);
        s.sy.v += (280 * (syT - s.sy.s) - 9 * s.sy.v) * dt;
        s.sy.s += s.sy.v * dt;
        if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02) still = false;
        // break the neck: spawn droplets between head and tail
        const sep = Math.abs(s.a.x - s.b.x);
        const r = T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
        if (!s.split && s.moving && sep - 2 * T.q - 2 * r > -6) {
          s.split = true;
          const lo = bodies[1 - s.lead], hi = bodies[s.lead];
          [0.3, 0.5, 0.72].forEach((t, j) => {
            s.sats.push({
              x: lo.x + (hi.x - lo.x) * t + (Math.random() - 0.5) * 6, y: T.cy + (Math.random() - 0.5) * 10,
              vx: (lo.v + hi.v) * 0.45, vy: (Math.random() - 0.5) * 60,
              r: 5 + Math.random() * 3 - j * 0.5, k: 70 + Math.random() * 90
            });
          });
        }
        s.sats = s.sats.filter((d) => {
          d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt;
          d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
          d.x += d.vx * dt; d.y += d.vy * dt;
          d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + s.w - 8 - d.r, d.x));
          d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
          if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
          return d.r > 0.6;
        });
        if (s.sats.length) still = false;
      }
      if (s.moving && still) {
        s.moving = false;
        if (s.split || !s.reduce) s.rips.push({ x: T.x, y: T.cy, age: 0, amp: s.split ? 1.2 : 0.7 });
      }
      s.rips.forEach((p) => (p.age += dt));
      s.rips = s.rips.filter((p) => p.age < 2.4);
      s.mouse.s += ((s.mouse.on ? 1 : 0) - s.mouse.s) * Math.min(1, dt * 7);
    }

    function loop() {
      if (s.raf) return;
      s.last = performance.now();
      const tick = (now) => {
        const dt = Math.min((now - s.last) / 1000, 1 / 30);
        s.last = now;
        step(dt, now); draw();
        const busy = s.moving || s.rips.length || s.sats.length || s.mouse.s > 0.01;
        // ambient water keeps moving while visible; reduced-motion only animates on change
        s.raf = s.visible && (!s.reduce || busy) ? requestAnimationFrame(tick) : 0;
      };
      s.raf = requestAnimationFrame(tick);
    }

    /* ---- layout ---- */
    function measure() {
      const el = els[current];
      if (!el || !nav.offsetWidth) return;
      s.w = nav.offsetWidth; s.h = nav.offsetHeight;
      const T = s.t;
      T.r = el.offsetHeight / 2;
      T.q = Math.max(0, el.offsetWidth / 2 - T.r);
      T.cy = PAD + el.offsetTop + el.offsetHeight / 2;
      const nx = PAD + el.offsetLeft + el.offsetWidth / 2;
      if (!s.ready) {
        s.a.x = s.b.x = nx; s.q = T.q; s.ready = true;
      } else if (Math.abs(nx - T.x) > 0.5) {
        s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1;
        s.lagFrom = performance.now() + 70;
        s.moving = true; s.split = false;
      }
      T.x = nx;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = s.w + PAD * 2, Hh = s.h + PAD * 2;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(Hh * dpr)) {
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hh * dpr);
        canvas.style.width = W + 'px'; canvas.style.height = Hh + 'px';
      }
      loop();
    }

    /* ---- interaction ---- */
    const local = (cx, cy) => { const r = nav.getBoundingClientRect(); return { x: cx - r.left + PAD, y: cy - r.top + PAD }; };
    function ripple(x, y, amp) { if (s.reduce) return; s.rips.push({ x, y, age: 0, amp }); loop(); }
    function iconCenter(i) {
      const el = icos[i]; if (!el) return null;
      const b = el.getBoundingClientRect();
      return local(b.left + b.width / 2, b.top + b.height / 2);
    }
    function playFx(i, kind) {
      icos.forEach((el, j) => { if (j !== i) el.removeAttribute('data-fx'); });
      const el = icos[i];
      el.removeAttribute('data-fx');
      if (kind === 'none') return;
      void el.offsetWidth; // restart the CSS animation on repeat taps
      el.setAttribute('data-fx', kind);
    }
    function select(i, silent) {
      const it = items[i]; if (!it) return;
      const kind = it.fx || (it.icon ? 'pop' : 'none');
      playFx(i, kind);
      const c = iconCenter(i);
      if (c && kind === 'drop') setTimeout(() => ripple(c.x, s.t.cy, 1.4), 430);
      if (c && kind === 'plane') ripple(c.x, c.y, 0.6);
      if (i !== current) {
        current = i; paintCurrent(); measure();
        if (!silent && onChange) onChange(i, it);
      }
    }
    function setActive(i) {
      if (i === current || !items[i]) return;
      current = i; paintCurrent(); measure();
    }
    function setLabels(labels) {
      els.forEach((b, i) => {
        if (labels[i] == null) return;
        b.title = labels[i]; b.setAttribute('aria-label', labels[i]);
        b.querySelector('.nimbus-label').textContent = labels[i];
      });
      s.ready = false; measure();
    }

    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = (current + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
      select(n); els[n].focus();
    });
    nav.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = local(e.clientX, e.clientY);
      s.mouse.x = p.x; s.mouse.y = p.y; s.mouse.on = true; loop();
    });
    nav.addEventListener('pointerleave', () => { s.mouse.on = false; loop(); });
    nav.addEventListener('pointerdown', (e) => { const p = local(e.clientX, e.clientY); ripple(p.x, p.y, 0.8); });

    /* ---- lifecycle ---- */
    s.glc = initGL(canvas);
    if (!s.glc) nav.dataset.gl = 'off';
    const onLost = (e) => { e.preventDefault(); s.glc = null; nav.dataset.gl = 'off'; };
    canvas.addEventListener('webglcontextlost', onLost);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => { s.visible = en[0].isIntersecting; if (s.visible) loop(); }) : null;
    if (io) io.observe(nav);
    const onVis = () => { s.visible = document.visibilityState === 'visible'; if (s.visible) loop(); };
    document.addEventListener('visibilitychange', onVis);
    const onMotion = (e) => { s.reduce = e.matches; loop(); };
    if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener('change', onMotion);
    let lastW = -1;
    const ro = new ResizeObserver(() => { if (nav.offsetWidth !== lastW) { lastW = nav.offsetWidth; s.ready = false; measure(); } });
    ro.observe(nav);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { s.ready = false; measure(); });
    measure();

    return {
      el: nav, setActive, setLabels, select: (i) => select(i, true),
      get current() { return current; },
      destroy() {
        cancelAnimationFrame(s.raf); s.raf = 0; ro.disconnect(); if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (reduceQuery && reduceQuery.removeEventListener) reduceQuery.removeEventListener('change', onMotion);
        canvas.removeEventListener('webglcontextlost', onLost); nav.remove();
      }
    };
  }

  window.LiquidNav = { mount, ICONS };
})();
