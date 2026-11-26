/* [K]inference benchmark post: interactive figures.
   Inline SVG drawn for the data, no chart library. Data: window.KB_DATA (data.js, exported from results/). */
(function () {
  'use strict';

  const D = window.KB_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const ARM = { kinf: 'Kinference', svc: 'Plain Service' };
  const WL = { control: 'Control', 'shared-prefix': 'Shared prefix', multiturn: 'Multiturn chat', 'agentic-mix': 'Agentic mix' };
  const LOG_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

  /* ---------- small helpers ---------- */
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function hv(tag, attrs, parent, text) {
    const e = document.createElement(tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, attrs, s) { const t = sv('text', attrs, parent); t.textContent = s; return t; }
  const fmtS = v => v < 1 ? Math.round(v * 1000) + ' ms' : v < 10 ? v.toFixed(2) + ' s' : v.toFixed(1) + ' s';
  const fmtTick = v => v < 1 ? Math.round(v * 1000) + ' ms' : v + ' s';
  const pct = v => Math.round(v * 100) + '%';
  const median = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function lin(d0, d1, r0, r1) {
    const f = v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
    f.inv = p => d0 + (p - r0) / (r1 - r0) * (d1 - d0);
    return f;
  }
  function logScale(d0, d1, r0, r1) {
    const a = Math.log10(d0), b = Math.log10(d1);
    const f = v => r0 + (Math.log10(Math.max(v, d0)) - a) / (b - a) * (r1 - r0);
    f.inv = p => Math.pow(10, a + (p - r0) / (r1 - r0) * (b - a));
    return f;
  }
  function nice(max, n) {
    const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1) * mag;
    const t = [];
    for (let v = 0; v < max + step - 1e-9; v += step) t.push(+v.toFixed(6));
    return t;
  }

  /* ---------- chart frame, axes, tooltip, hover ---------- */
  function frame(host, height, m) {
    host.textContent = '';
    const w = Math.max(280, Math.round(host.clientWidth || 640));
    m = m || { t: 14, r: 18, b: 44, l: 54 };
    const svg = sv('svg', { viewBox: `0 0 ${w} ${height}`, width: w, height: height, 'aria-hidden': 'true', focusable: 'false' }, host);
    const g = sv('g', { transform: `translate(${m.l},${m.t})` }, svg);
    return { svg, g, w, h: height, m, iw: w - m.l - m.r, ih: height - m.t - m.b };
  }
  function yAxis(c, y, ticks, fmt, label) {
    const grid = sv('g', { class: 'kb-grid' }, c.g), ax = sv('g', { class: 'kb-axis' }, c.g);
    ticks.forEach(t => {
      const p = Math.round(y(t)) + 0.5;
      sv('line', { x1: 0, x2: c.iw, y1: p, y2: p }, grid);
      txt(ax, { x: -8, y: p + 4, 'text-anchor': 'end' }, fmt(t));
    });
    if (label) txt(c.g, { class: 'kb-axis-label', transform: `translate(${12 - c.m.l},${c.ih / 2}) rotate(-90)`, 'text-anchor': 'middle' }, label);
  }
  function xAxis(c, x, ticks, fmt, label) {
    const ax = sv('g', { class: 'kb-axis' }, c.g);
    ticks.forEach(t => txt(ax, { x: x(t), y: c.ih + 17, 'text-anchor': 'middle' }, fmt(t)));
    if (label) txt(c.g, { class: 'kb-axis-label', x: c.iw / 2, y: c.ih + 36, 'text-anchor': 'middle' }, label);
  }
  function refLine(c, x1, y1, x2, y2, label, anchor) {
    sv('line', { class: 'kb-ref', x1, y1, x2, y2 }, c.g);
    if (label) txt(c.g, { class: 'kb-ref-label', x: anchor === 'end' ? x2 - 4 : x1 + 4, y: Math.min(y1, y2) + (y1 === y2 ? -5 : 12), 'text-anchor': anchor || 'start' }, label);
  }
  function Tip(fig) {
    const t = hv('div', { class: 'kb-tip', role: 'status', 'aria-live': 'polite' }, fig);
    return {
      show(html, x, y) {
        t.innerHTML = html;
        t.classList.add('kb-on');
        const fw = fig.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
        let left = x + 14;
        if (left + tw > fw - 6) left = x - tw - 14;
        t.style.left = Math.max(6, left) + 'px';
        t.style.top = Math.max(6, y - th / 2) + 'px';
      },
      hide() { t.classList.remove('kb-on'); }
    };
  }
  /* pick(px, py) -> {x, y, html, cross} in plot coordinates, or null. steps: [[px, py], ...] for arrow keys. */
  function hover(c, host, fig, tip, pick, steps) {
    const cross = sv('line', { class: 'kb-cross', x1: 0, x2: 0, y1: 0, y2: c.ih, visibility: 'hidden' }, c.g);
    const ov = sv('rect', { class: 'kb-hit', x: 0, y: 0, width: c.iw, height: c.ih }, c.g);
    let idx = -1;
    const off = () => { tip.hide(); cross.setAttribute('visibility', 'hidden'); };
    function place(px, py) {
      const r = pick(px, py);
      if (!r) return off();
      if (r.cross === false) cross.setAttribute('visibility', 'hidden');
      else { cross.setAttribute('x1', r.x); cross.setAttribute('x2', r.x); cross.setAttribute('visibility', 'visible'); }
      const sr = c.svg.getBoundingClientRect(), fr = fig.getBoundingClientRect(), k = sr.width / c.w;
      tip.show(r.html, sr.left - fr.left + (c.m.l + r.x) * k, sr.top - fr.top + (c.m.t + (r.y === undefined ? py : r.y)) * k);
    }
    const local = e => { const sr = c.svg.getBoundingClientRect(), k = c.w / sr.width; return [(e.clientX - sr.left) * k - c.m.l, (e.clientY - sr.top) * k - c.m.t]; };
    ov.addEventListener('pointermove', e => { const p = local(e); place(p[0], p[1]); });
    ov.addEventListener('pointerdown', e => { const p = local(e); place(p[0], p[1]); });
    ov.addEventListener('pointerleave', off);
    host.onkeydown = e => {
      if (!steps || !steps.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        idx = clamp(idx + (e.key === 'ArrowRight' ? 1 : -1), 0, steps.length - 1);
        place(steps[idx][0], steps[idx][1]);
      } else if (e.key === 'Escape') off();
    };
    host.onblur = () => { off(); idx = -1; };
  }
  function seg(parent, options, value, onChange, label) {
    const g = hv('div', { class: 'kb-seg', role: 'group', 'aria-label': label }, parent);
    options.forEach(o => {
      const b = hv('button', { type: 'button', 'aria-pressed': String(o[0] === value) }, g, o[1]);
      b.addEventListener('click', () => {
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        onChange(o[0]);
      });
    });
    return g;
  }
  function legend(parent, items) {
    const l = hv('div', { class: 'kb-legend' }, parent);
    items.forEach(it => { const s = hv('span', {}, l); hv('i', { class: 'kb-sw ' + it[0] }, s); s.appendChild(document.createTextNode(it[1])); });
    return l;
  }
  function onResize(host, draw) {
    if (!window.ResizeObserver) return;
    let last = host.clientWidth;
    new ResizeObserver(() => { const w = host.clientWidth; if (Math.abs(w - last) > 4) { last = w; draw(); } }).observe(host);
  }
  function linePath(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(''); }
  function barPath(x, base, top, w) {
    const r = Math.min(2, Math.abs(base - top));
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
  }
  function parts(fig) { return { ctr: fig.querySelector('.kb-controls'), host: fig.querySelector('.kb-chart'), tip: Tip(fig) }; }

  /* ---------- 1. TTFT distribution (CDF) ---------- */
  function cdfFig(fig) {
    const { ctr, host, tip } = parts(fig);
    let wl = 'shared-prefix';
    seg(ctr, ['shared-prefix', 'multiturn', 'agentic-mix', 'control'].map(w => [w, WL[w]]), wl, v => { wl = v; draw(); }, 'Workload');
    legend(ctr, [['kb-k', ARM.kinf], ['', ARM.svc]]);
    const note = hv('p', { class: 'kb-note' });
    host.after(note);
    function draw() {
      const d = D.cdf[wl], all = d.kinf.concat(d.svc);
      const lo = LOG_TICKS.filter(t => t <= Math.min.apply(null, all) * 0.95).pop() || 0.1;
      const hi = LOG_TICKS.find(t => t >= Math.max.apply(null, all) * 1.05) || 100;
      const c = frame(host, 310);
      const x = logScale(lo, hi, 0, c.iw), y = lin(0, 1, c.ih, 0);
      yAxis(c, y, [0, 0.25, 0.5, 0.75, 1], pct, 'Share of requests');
      xAxis(c, x, LOG_TICKS.filter(t => t >= lo && t <= hi), fmtTick, 'Time to first token (log scale)');
      if (D.slo[wl]) refLine(c, x(D.slo[wl]), 0, x(D.slo[wl]), c.ih, 'SLO ' + D.slo[wl] + ' s');
      ['svc', 'kinf'].forEach(a => {
        const s = d[a], n = s.length;
        let p = `M0,${y(0)}`;
        s.forEach((v, i) => { p += `H${x(v).toFixed(1)}V${y((i + 1) / n).toFixed(1)}`; });
        p += `H${c.iw}`;
        sv('path', { class: 'kb-line ' + (a === 'kinf' ? 'kb-s-k' : 'kb-s-b'), d: p }, c.g);
      });
      const share = (a, v) => d[a].filter(t => t <= v).length / d[a].length;
      const steps = [];
      for (let i = 0; i <= 24; i++) steps.push([c.iw * i / 24, y(0.5)]);
      hover(c, host, fig, tip, px => {
        if (px < 0 || px > c.iw) return null;
        const v = x.inv(px);
        return { x: px, y: y(0.5), html: `<b>First token within ${fmtS(v)}</b><br>${ARM.kinf}: ${pct(share('kinf', v))} of requests<br>${ARM.svc}: ${pct(share('svc', v))}` };
      }, steps);
      note.textContent = `Median ${ARM.kinf} ${fmtS(median(d.kinf))}, ${ARM.svc} ${fmtS(median(d.svc))}. ${d.kinf.length} measured requests per arm over 3 trials.`;
    }
    draw();
    onResize(host, draw);
  }

  /* ---------- 2. every request in one trial ---------- */
  function scatterFig(fig) {
    const { ctr, host, tip } = parts(fig);
    let show = 'both';
    seg(ctr, [['both', 'Both arms'], ['kinf', ARM.kinf], ['svc', ARM.svc]], show, v => { show = v; draw(); }, 'Arms shown');
    legend(ctr, [['kb-k kb-dot', ARM.kinf], ['kb-dot', ARM.svc], ['kb-fill', 'prefix was cached'], ['kb-ring', 'cache miss']]);
    function draw() {
      const S = D.scatter, c = frame(host, 300);
      const x = lin(0, S.window_s, 0, c.iw), y = logScale(0.2, 50, c.ih, 0);
      yAxis(c, y, [0.2, 0.5, 1, 2, 5, 10, 20, 50], fmtTick, 'TTFT (log scale)');
      xAxis(c, x, [0, 60, 120, 180, 240], v => v + ' s', 'When the request arrived (measured window)');
      const pts = [];
      ['svc', 'kinf'].forEach(a => {
        if (show !== 'both' && show !== a) return;
        S[a].forEach(r => {
          const hit = r.cached > 8000, k = a === 'kinf' ? 'k' : 'b';
          const px = x(r.t), py = y(r.ttft);
          sv('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 4, class: hit ? 'kb-f-' + k : 'kb-ring-' + k }, c.g);
          pts.push({ px, py, a, r, hit });
        });
      });
      refLine(c, 0, y(8.21), c.iw, y(8.21), 'uncached 16k prefill ≈ 8.2 s', 'end');
      pts.sort((p, q) => p.px - q.px);
      hover(c, host, fig, tip, (px, py) => {
        let best = null, bd = 16 * 16;
        pts.forEach(p => { const dd = (p.px - px) ** 2 + (p.py - py) ** 2; if (dd < bd) { bd = dd; best = p; } });
        if (!best) return null;
        return { x: best.px, y: best.py, cross: false, html: `<b>${ARM[best.a]}</b><br>arrived at ${Math.round(best.r.t)} s<br>first token after <b>${fmtS(best.r.ttft)}</b><br>${best.r.cached.toLocaleString()} cached prompt tokens${best.hit ? '' : ' (miss)'}` };
      }, pts.map(p => [p.px, p.py]));
    }
    draw();
    onResize(host, draw);
  }

  /* ---------- 3. capacity: goodput / attainment / hit rate vs concurrency ---------- */
  function lineSeriesChart(fig, host, tip, cfg) {
    const c = frame(host, cfg.height || 300);
    const xs = cfg.xs, xmax = xs[xs.length - 1];
    const x = lin(0, xmax + (xmax > 10 ? 2 : 0.3), 0, c.iw);
    const vals = cfg.series.flatMap(s => s.v).filter(v => v !== null && v !== undefined);
    const ticks = cfg.pct ? [0, 0.25, 0.5, 0.75, 1] : nice(Math.max.apply(null, vals) * 1.08, 4);
    const y = lin(0, ticks[ticks.length - 1], c.ih, 0);
    yAxis(c, y, ticks, cfg.pct ? pct : (v => String(v)), cfg.ylabel);
    xAxis(c, x, xs, String, cfg.xlabel);
    if (cfg.ref) refLine(c, 0, y(cfg.ref.v), c.iw, y(cfg.ref.v), cfg.ref.label, 'end');
    cfg.series.forEach(s => {
      const pts = xs.map((xv, i) => [x(xv), y(s.v[i] || 0)]);
      sv('path', { class: 'kb-line ' + (s.k ? 'kb-s-k' : 'kb-s-b'), d: linePath(pts) }, c.g);
      pts.forEach(p => sv('circle', { cx: p[0], cy: p[1], r: 3.5, class: s.k ? 'kb-f-k' : 'kb-f-b' }, c.g));
    });
    hover(c, host, fig, tip, px => {
      let i = 0;
      xs.forEach((xv, j) => { if (Math.abs(x(xv) - px) < Math.abs(x(xs[i]) - px)) i = j; });
      return { x: x(xs[i]), y: y(Math.max.apply(null, cfg.series.map(s => s.v[i] || 0))), html: cfg.tip(i) };
    }, xs.map(xv => [x(xv), c.ih / 2]));
  }

  function capFig(fig) {
    const { ctr, host, tip } = parts(fig);
    let wl = 'multiturn', metric = 'goodput';
    seg(ctr, ['multiturn', 'shared-prefix', 'agentic-mix'].map(w => [w, WL[w]]), wl, v => { wl = v; draw(); }, 'Workload');
    seg(ctr, [['goodput', 'Goodput'], ['attain', 'SLO attainment'], ['hit', 'Cache hit rate']], metric, v => { metric = v; draw(); }, 'Metric');
    legend(ctr, [['kb-k', ARM.kinf], ['', ARM.svc]]);
    const note = hv('p', { class: 'kb-note' });
    host.after(note);
    function draw() {
      const d = D.capacity[wl];
      const fmt = metric === 'goodput' ? (v => v.toFixed(1) + ' req/min') : pct;
      lineSeriesChart(fig, host, tip, {
        xs: d.conc,
        pct: metric !== 'goodput',
        xlabel: 'Concurrent clients',
        ylabel: { goodput: 'Requests/min within SLO', attain: 'Requests within SLO', hit: 'Prefix-cache hit rate' }[metric],
        ref: metric === 'attain' ? { v: 0.9, label: 'target: 90% within SLO' } : null,
        series: [{ k: false, v: d.svc[metric] }, { k: true, v: d.kinf[metric] }],
        tip: i => {
          const k = d.kinf[metric][i], s = d.svc[metric][i];
          let h = `<b>${d.conc[i]} concurrent clients</b><br>${ARM.kinf}: ${fmt(k)}<br>${ARM.svc}: ${fmt(s)}`;
          if (metric === 'goodput' && s > 0.05) h += `<br>${(k / s).toFixed(1)}× at this load`;
          return h;
        }
      });
      note.textContent = `SLO: time to first token at most ${d.slo_s} s; a level meets the SLO when 90% of requests do. Each point is the mean of 3 trials (agentic mix: 2).`;
    }
    draw();
    onResize(host, draw);
  }

  /* ---------- 4. shared-prefix: requests that found their prefix ---------- */
  function spHitsFig(fig) {
    const { ctr, host, tip } = parts(fig);
    legend(ctr, [['kb-k', ARM.kinf], ['', ARM.svc]]);
    const d = D.sp_hits;
    const draw = () => lineSeriesChart(fig, host, tip, {
      xs: d.conc, pct: true, height: 260,
      xlabel: 'Concurrent clients', ylabel: 'Requests with prefix cached',
      series: [{ k: false, v: d.svc }, { k: true, v: d.kinf }],
      tip: i => `<b>${d.conc[i]} concurrent clients</b><br>${ARM.kinf}: ${pct(d.kinf[i])} found their 16k prefix<br>${ARM.svc}: ${pct(d.svc[i])}`
    });
    draw();
    onResize(host, draw);
  }

  /* ---------- 5. pool-size sweep ---------- */
  function sweepFig(fig) {
    const { ctr, host, tip } = parts(fig);
    let wl = 'multiturn', metric = 'goodput';
    seg(ctr, ['multiturn', 'shared-prefix'].map(w => [w, WL[w]]), wl, v => { wl = v; draw(); }, 'Workload');
    seg(ctr, [['goodput', 'Goodput'], ['hit', 'Cache hit rate']], metric, v => { metric = v; draw(); }, 'Metric');
    legend(ctr, [['kb-k kb-box', ARM.kinf], ['kb-box', ARM.svc]]);
    function draw() {
      const d = D.sweep[wl], c = frame(host, 290);
      const S = metric === 'goodput' ? d.goodput_svc : d.hit_svc, K = metric === 'goodput' ? d.goodput_kinf : d.hit_kinf;
      const ticks = metric === 'goodput' ? nice(Math.max.apply(null, K.concat(S)) * 1.08, 4) : [0, 0.25, 0.5, 0.75, 1];
      const y = lin(0, ticks[ticks.length - 1], c.ih, 0), fmt = metric === 'goodput' ? String : pct;
      yAxis(c, y, ticks, fmt, metric === 'goodput' ? 'Requests/min within SLO' : 'Prefix-cache hit rate');
      const band = c.iw / d.pods.length, bw = Math.min(24, band * 0.22), gap = 4;
      const ax = sv('g', { class: 'kb-axis' }, c.g);
      d.pods.forEach((p, i) => {
        const cx = band * (i + 0.5);
        sv('path', { class: 'kb-f-b', d: barPath(cx - bw - gap / 2, y(0), y(S[i]), bw) }, c.g);
        sv('path', { class: 'kb-f-k', d: barPath(cx + gap / 2, y(0), y(K[i]), bw) }, c.g);
        txt(ax, { x: cx, y: c.ih + 17, 'text-anchor': 'middle' }, p === 1 ? '1 pod per pool' : p + ' pods per pool');
      });
      txt(c.g, { class: 'kb-axis-label', x: c.iw / 2, y: c.ih + 36, 'text-anchor': 'middle' }, 'Pool size, at 8 concurrent clients');
      const f = metric === 'goodput' ? (v => v.toFixed(1) + ' req/min') : pct;
      hover(c, host, fig, tip, px => {
        const i = clamp(Math.floor(px / band), 0, d.pods.length - 1);
        const sig = d.ci_lo[i] > 0 ? '' : ' (not significant)';
        return { x: band * (i + 0.5), y: y(Math.max(K[i], S[i])), cross: false,
          html: `<b>${d.pods[i]} pod${d.pods[i] > 1 ? 's' : ''} per pool</b><br>${ARM.kinf}: ${f(K[i])}<br>${ARM.svc}: ${f(S[i])}<br>goodput ratio ${d.ratio[i].toFixed(2)}×${sig}` };
      }, d.pods.map((p, i) => [band * (i + 0.5), c.ih / 2]));
    }
    draw();
    onResize(host, draw);
  }

  /* ---------- 6. control: requests per pod ---------- */
  function podsFig(fig) {
    const { host, tip } = parts(fig);
    function draw() {
      const P = D.control_pods, c = frame(host, 128, { t: 6, r: 14, b: 30, l: 112 });
      const rows = [['kinf', P.kinf, [0, 1, 2]], ['svc', P.svc, [3, 4, 5]]];
      const total = Math.max.apply(null, rows.map(r => r[1].reduce((a, b) => a + b, 0)));
      const x = lin(0, total, 0, c.iw), rh = 26, segs = [];
      const ax = sv('g', { class: 'kb-axis' }, c.g);
      nice(total, 4).filter(t => t <= total).forEach(t => txt(ax, { x: x(t), y: c.ih + 17, 'text-anchor': 'middle' }, String(t)));
      rows.forEach((r, ri) => {
        const y0 = ri * (rh + 14) + 4, k = r[0] === 'kinf' ? 'kb-f-k' : 'kb-f-b', sum = r[1].reduce((a, b) => a + b, 0);
        txt(c.g, { class: 'kb-row-label', x: -10, y: y0 + rh / 2 + 4, 'text-anchor': 'end' }, ARM[r[0]]);
        let acc = 0;
        r[1].forEach((n, i) => {
          const x0 = x(acc), w = x(acc + n) - x0 - 2;
          sv('rect', { x: x0, y: y0, width: Math.max(0, w), height: rh, class: k, opacity: [1, 0.72, 0.5][i] }, c.g);
          txt(c.g, { class: 'kb-seg-label', x: x0 + w / 2, y: y0 + rh / 2 + 4, 'text-anchor': 'middle' }, String(n));
          segs.push({ x0, x1: x0 + w, y0, y1: y0 + rh, html: `<b>${ARM[r[0]]}, GPU ${r[2][i]}</b><br>${n} of ${sum} control requests (${pct(n / sum)})` });
          acc += n;
        });
      });
      hover(c, host, fig, tip, (px, py) => {
        const s = segs.find(q => px >= q.x0 && px <= q.x1 && py >= q.y0 && py <= q.y1);
        return s ? { x: (s.x0 + s.x1) / 2, y: s.y0, cross: false, html: s.html } : null;
      }, segs.map(s => [(s.x0 + s.x1) / 2, s.y0]));
    }
    draw();
    onResize(host, draw);
  }

  /* ---------- 7. GPU clocks + direct prefill probe ---------- */
  function gpuFig(fig) {
    const tip = Tip(fig), G = D.gpu;
    const ctr = fig.querySelector('.kb-controls');
    legend(ctr, [['kb-k kb-box', 'Pool A, GPUs 0 to 2 (served Kinference)'], ['kb-box', 'Pool B, GPUs 3 to 5 (served Plain Service)']]);
    const hClock = fig.querySelector('[data-part="clock"]'), hProbe = fig.querySelector('[data-part="probe"]');
    function drawClock() {
      const B = G.busy, c = frame(hClock, 250, { t: 12, r: 12, b: 44, l: 64 });
      const y = lin(0, 3000, c.ih, 0), band = c.iw / B.length, pts = [];
      yAxis(c, y, [0, 1000, 2000, 3000], v => v ? (v / 1000) + ' GHz' : '0', 'SM clock at the 300 W cap');
      const ax = sv('g', { class: 'kb-axis' }, c.g);
      B.forEach((b, i) => {
        const cx = band * (i + 0.5);
        b.mhz.forEach((m, t) => {
          const px = cx + (t - 1) * 7;
          sv('circle', { cx: px, cy: y(m), r: 4.5, class: b.pool === 'a' ? 'kb-f-k' : 'kb-f-b' }, c.g);
          pts.push({ px, py: y(m), html: `<b>GPU ${b.gpu}, pool ${b.pool.toUpperCase()}, trial ${t + 1}</b><br>median ${m} MHz while drawing over 290 W` });
        });
        txt(ax, { x: cx, y: c.ih + 17, 'text-anchor': 'middle' }, 'GPU ' + b.gpu);
      });
      txt(c.g, { class: 'kb-axis-label', x: c.iw / 2, y: c.ih + 36, 'text-anchor': 'middle' }, 'Control runs, one dot per trial');
      hover(c, hClock, fig, tip, (px, py) => {
        let best = null, bd = 18 * 18;
        pts.forEach(p => { const dd = (p.px - px) ** 2 + (p.py - py) ** 2; if (dd < bd) { bd = dd; best = p; } });
        return best ? { x: best.px, y: best.py, cross: false, html: best.html } : null;
      }, pts.map(p => [p.px, p.py]));
    }
    function drawProbe() {
      const P = G.probe, c = frame(hProbe, 250, { t: 12, r: 12, b: 44, l: 64 });
      const y = lin(0, 10, c.ih, 0), band = c.iw / P.length, bw = Math.min(24, band * 0.5);
      yAxis(c, y, [0, 2.5, 5, 7.5, 10], v => v + ' s', 'Median 16k prefill');
      const ax = sv('g', { class: 'kb-axis' }, c.g);
      P.forEach((p, i) => {
        const cx = band * (i + 0.5);
        sv('path', { class: p.pool === 'a' ? 'kb-f-k' : 'kb-f-b', d: barPath(cx - bw / 2, y(0), y(p.median_s), bw) }, c.g);
        txt(ax, { x: cx, y: c.ih + 17, 'text-anchor': 'middle' }, 'GPU ' + p.gpu);
      });
      txt(c.g, { class: 'kb-axis-label', x: c.iw / 2, y: c.ih + 36, 'text-anchor': 'middle' }, 'Direct probe, all GPUs warm');
      hover(c, hProbe, fig, tip, px => {
        const i = clamp(Math.floor(px / band), 0, P.length - 1), p = P[i];
        return { x: band * (i + 0.5), y: y(p.median_s), cross: false, html: `<b>GPU ${p.gpu}, pool ${p.pool.toUpperCase()}</b><br>median prefill ${fmtS(p.median_s)}<br>${p.mhz} MHz, ${p.temp_c} °C` };
      }, P.map((p, i) => [band * (i + 0.5), y(p.median_s)]));
    }
    drawClock(); drawProbe();
    onResize(hClock, drawClock); onResize(hProbe, drawProbe);
  }

  /* ---------- sliders + HTML bars (sim, kv) ---------- */
  let uid = 0;
  function slider(parent, o, onInput) {
    const wrap = hv('div', { class: 'kb-slider' }, parent), id = 'kb-s' + (++uid);
    const lab = hv('label', { for: id }, wrap);
    lab.appendChild(document.createTextNode(o.label));
    const out = hv('output', { for: id }, lab, o.fmt(o.value));
    const inp = hv('input', { type: 'range', id, min: o.min, max: o.max, step: o.step, value: o.value }, wrap);
    inp.addEventListener('input', () => { out.textContent = o.fmt(+inp.value); onInput(); });
    return { get: () => +inp.value, set: v => { inp.value = v; out.textContent = o.fmt(v); } };
  }
  function barRow(parent, label, cls) {
    const row = hv('div', { class: 'kb-bar-row' }, parent);
    hv('span', {}, row, label);
    const i = hv('i', { class: cls }, hv('div', { class: 'kb-track' }, row));
    const out = hv('output', {}, row);
    return {
      set(frac, text, c) {
        i.style.transform = 'scaleX(' + clamp(frac, 0, 1) + ')';
        out.textContent = text;
        if (c) i.className = c;
      }
    };
  }

  /* ---------- 8. toy routing simulator ---------- */
  function mulberry(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function simulate(N, C, K, spill, zipf, aware) {
    const pr = mulberry(7), rr = mulberry(11), cum = [];
    let tot = 0;
    for (let k = 0; k < K; k++) { tot += zipf ? 1 / Math.pow(k + 1, 1.1) : 1; cum.push(tot); }
    const caches = Array.from({ length: N }, () => new Map()), load = new Array(N).fill(0);
    const T = 6000, W = 1500;
    let hits = 0, n = 0;
    for (let i = 0; i < T; i++) {
      const u = pr() * tot;
      let p = 0;
      while (cum[p] < u) p++;
      let pod;
      if (!aware || N === 1) pod = Math.floor(rr() * N);
      else {
        let holder = -1;
        for (let j = 0; j < N; j++) if (caches[j].has(p)) { holder = j; break; }
        if (holder >= 0 && rr() >= spill) pod = holder;
        else if (holder >= 0) { pod = Math.floor(rr() * (N - 1)); if (pod >= holder) pod++; }
        else { pod = 0; for (let j = 1; j < N; j++) if (load[j] < load[pod]) pod = j; }
      }
      load[pod]++;
      const cache = caches[pod], hit = cache.has(p);
      if (hit) cache.delete(p);
      cache.set(p, 1);
      if (cache.size > C) cache.delete(cache.keys().next().value);
      if (i >= W) { n++; if (hit) hits++; }
    }
    return hits / n;
  }
  function simFig(fig) {
    const host = fig.querySelector('.kb-chart');
    host.textContent = '';
    let zipf = false;
    const ctr = hv('div', { class: 'kb-controls' }, host);
    seg(ctr, [[false, 'Every prefix equally popular'], [true, 'A few hot prefixes (Zipf)']], zipf, v => { zipf = v; run(); }, 'Prefix popularity');
    const sl = hv('div', { class: 'kb-sliders' }, host);
    const N = slider(sl, { label: 'GPUs (pods) in the pool', min: 1, max: 6, step: 1, value: 3, fmt: String }, run);
    const C = slider(sl, { label: 'Prefixes one GPU can cache', min: 1, max: 12, step: 1, value: 8, fmt: String }, run);
    const K = slider(sl, { label: 'Distinct shared prefixes', min: 2, max: 48, step: 1, value: 24, fmt: String }, run);
    const SP = slider(sl, { label: 'Spill under load', min: 0, max: 0.6, step: 0.05, value: 0, fmt: v => pct(v) }, run);
    const bars = hv('div', { class: 'kb-bars' }, host);
    const rR = barRow(bars, 'Random (kube-proxy)', ''), rA = barRow(bars, 'Cache-aware', 'kb-k');
    const verdict = hv('p', { class: 'kb-verdict', 'aria-live': 'polite' }, host);
    function run() {
      const n = N.get(), c = C.get(), k = K.get(), s = SP.get();
      const hr = simulate(n, c, k, s, zipf, false), ha = simulate(n, c, k, s, zipf, true);
      rR.set(hr, pct(hr)); rA.set(ha, pct(ha));
      const fill = k / (n * c);
      verdict.innerHTML = `Cache hit rate. The prefixes need <strong>${pct(fill)}</strong> of the pool's cache (${k} of ${n * c} slots). ` +
        (n === 1 ? 'With one GPU there is nothing to choose, so routing cannot matter.'
          : fill > 1 ? 'They do not fit, so even perfect routing has to evict something.'
            : s > 0 ? 'Spilling copies hot prefixes onto a second GPU, which costs cache space.'
              : 'Cache-aware routing gives each GPU its own share of the prefixes; random routing makes every GPU hold all of them.');
    }
    run();
  }

  /* ---------- 9. KV working-set calculator ---------- */
  function kvFig(fig) {
    const host = fig.querySelector('.kb-chart'), KV = D.kv;
    host.textContent = '';
    const perTok = KV.kv_gib_per_pod * 1073741824 / KV.tokens_per_pod;
    const nonKv = KV.mem_util * KV.gpu_gib - KV.kv_gib_per_pod;
    let fp8 = false;
    const presets = hv('div', { class: 'kb-presets' }, host);
    const ctr = hv('div', { class: 'kb-controls' }, host);
    const dtype = seg(ctr, [[false, 'KV cache in BF16 (what I ran)'], [true, 'KV cache in FP8']], fp8, v => { fp8 = v; run(); }, 'KV cache data type');
    const sl = hv('div', { class: 'kb-sliders' }, host);
    const P = slider(sl, { label: 'Distinct shared prefixes', min: 1, max: 64, step: 1, value: 24, fmt: String }, run);
    const L = slider(sl, { label: 'Tokens per prefix', min: 1000, max: 32000, step: 1000, value: 16000, fmt: v => (v / 1000) + 'k' }, run);
    const N = slider(sl, { label: 'Pods in the pool', min: 1, max: 6, step: 1, value: 3, fmt: String }, run);
    const U = slider(sl, { label: 'gpu-memory-utilization', min: 0.85, max: 0.95, step: 0.01, value: 0.9, fmt: v => v.toFixed(2) }, run);
    const bars = hv('div', { class: 'kb-bars' }, host);
    const rCap = barRow(bars, 'KV cache in the pool', 'kb-outline'), rWs = barRow(bars, 'Shared prefixes', 'kb-k');
    const verdict = hv('p', { class: 'kb-verdict', 'aria-live': 'polite' }, host);
    const setDtype = v => { fp8 = v; dtype.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === v))); };
    [['What I ran', 24, 16000, 3, 0.9, false], ['Same, FP8 KV cache', 24, 16000, 3, 0.9, true], ['Same, memory 0.95', 24, 16000, 3, 0.95, false], ['Same, 4 pods', 24, 16000, 4, 0.9, false]]
      .forEach(p => {
        const b = hv('button', { type: 'button' }, hv('div', { class: 'kb-seg' }, presets), p[0]);
        b.addEventListener('click', () => { P.set(p[1]); L.set(p[2]); N.set(p[3]); U.set(p[4]); setDtype(p[5]); run(); });
      });
    const k = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1000) + 'k';
    function run() {
      const perPod = Math.max(0, U.get() * KV.gpu_gib - nonKv) * 1073741824 / (perTok / (fp8 ? 2 : 1));
      const pool = perPod * N.get(), ws = P.get() * L.get(), top = Math.max(pool, ws) * 1.04, r = ws / pool;
      rCap.set(pool / top, k(pool));
      rWs.set(ws / top, k(ws), r > 1 ? 'kb-over' : 'kb-k');
      verdict.innerHTML = `Each pod holds about <strong>${Math.round(perPod).toLocaleString()}</strong> tokens of KV cache. The prefixes need <strong>${pct(r)}</strong> of the pool. ` +
        (r > 1 ? 'They do not fit: under load the router copies hot prefixes, and the pool starts evicting ones it needs.'
          : r > 0.85 ? 'They barely fit. The tokens of running requests push it over the edge.'
            : 'They fit with room left for running requests, so cache-aware routing can keep every prefix warm.');
    }
    run();
  }

  const FIGS = { cdf: cdfFig, scatter: scatterFig, capacity: capFig, sphits: spHitsFig, sweep: sweepFig, pods: podsFig, gpu: gpuFig, sim: simFig, kv: kvFig };
  function init() {
    if (!D) return;
    document.querySelectorAll('[data-kb]').forEach(f => {
      const fn = FIGS[f.getAttribute('data-kb')];
      if (!fn) return;
      try { fn(f); } catch (e) { if (window.console) console.error('kb figure ' + f.getAttribute('data-kb'), e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
