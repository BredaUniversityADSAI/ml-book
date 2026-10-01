// Interactive line-fitting demos for "What is Machine Learning?".
//
// Every `.fit-demo[data-stage]` element on the page becomes one demo:
//   1: data + line, slope slider (intercept fixed)
//   2: same, plus the cost traced for every slope the reader tries
//   3: slope and intercept sliders, plus a cost map over both parameters
// Colors come from CSS custom properties in styles.css, so the charts follow
// the site's light/dark toggle.

(() => {
  "use strict";

  const DATA = [
    [0.8, 3.5], [1.7, 3.0], [2.6, 7.8], [3.4, 7.1], [4.5, 11.3],
    [5.3, 9.7], [6.2, 14.0], [7.1, 17.0], [8.0, 15.8], [9.2, 19.0],
  ];
  const FIXED_INTERCEPT = 1;
  const SLOPE = { min: 0, max: 4, step: 0.01, digits: 2 };
  const INTERCEPT = { min: -4, max: 6, step: 0.1, digits: 1 };
  const X_DOMAIN = [0, 10];
  const Y_DOMAIN = [0, 24];
  const COST_MAX = 130; // y-axis top of the stage-2 cost plot
  const GOOD_FIT = 1.1; // "great fit" when the cost is within 10% of the minimum
  const NS = "http://www.w3.org/2000/svg";

  // Lighter = lower cost, in both themes, so the page text stays true.
  const RAMP = {
    light: ["#f2f8fe", "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec",
            "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95"],
    dark: ["#cde2fb", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
           "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"],
  };

  const cost = (s, b) =>
    DATA.reduce((sum, [x, y]) => sum + (y - (s * x + b)) ** 2, 0) / DATA.length;

  // Closed-form best fits, used only for the "great fit" feedback.
  const n = DATA.length;
  const sx = DATA.reduce((a, [x]) => a + x, 0);
  const sy = DATA.reduce((a, [, y]) => a + y, 0);
  const sxx = DATA.reduce((a, [x]) => a + x * x, 0);
  const sxy = DATA.reduce((a, [x, y]) => a + x * y, 0);
  const bestSlopeFixed = (sxy - FIXED_INTERCEPT * sx) / sxx;
  const bestSlope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const bestIntercept = (sy - bestSlope * sx) / n;
  const MIN_COST_FIXED = cost(bestSlopeFixed, FIXED_INTERCEPT);
  const MIN_COST_FREE = cost(bestSlope, bestIntercept);

  let uid = 0;

  // ---------- small helpers ----------

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  function htmlEl(tag, className, parent, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function scale([d0, d1], [r0, r1]) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.invert = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    return f;
  }

  const ticks = (min, max, step) => {
    const out = [];
    for (let v = min; v <= max + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  };

  const snap = (v, { min, max, step }) =>
    Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

  const fmt = (v, digits) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(digits);

  function equation(s, b) {
    const sign = b < 0 ? "−" : "+";
    const bText = Number.isInteger(b) ? String(Math.abs(b)) : fmt(Math.abs(b), INTERCEPT.digits);
    return `ŷ = ${fmt(s, SLOPE.digits)}·x ${sign} ${bText}`;
  }

  const isDark = () => document.body.classList.contains("quarto-dark");

  // ---------- chart frame: axes, grid, ticks ----------

  // Builds an SVG with gridlines, axes and labels inside `host` and returns
  // the scales plus the SVG, so a chart can add its own marks.
  function frame(host, opts) {
    const width = host.clientWidth;
    const height = Math.round(Math.min(width * 0.72, 360));
    const m = { t: 14, r: 14, b: 42, l: 46 };
    host.querySelector("svg")?.remove();

    const svg = svgEl("svg", {
      class: "fit-svg", width, height, viewBox: `0 0 ${width} ${height}`,
      role: "img", "aria-label": opts.label,
    });
    host.appendChild(svg);

    const x = scale(opts.x.domain, [m.l, width - m.r]);
    const y = scale(opts.y.domain, [height - m.b, m.t]);
    const [x0, x1] = opts.x.domain;
    const [y0, y1] = opts.y.domain;

    if (opts.grid !== false) {
      for (const v of opts.y.ticks) {
        svgEl("line", { class: "fit-grid", x1: x(x0), x2: x(x1), y1: y(v), y2: y(v) }, svg);
      }
      for (const v of opts.x.ticks) {
        svgEl("line", { class: "fit-grid", x1: x(v), x2: x(v), y1: y(y0), y2: y(y1) }, svg);
      }
    }
    svgEl("line", { class: "fit-axis", x1: x(x0), x2: x(x1), y1: y(y0), y2: y(y0) }, svg);
    svgEl("line", { class: "fit-axis", x1: x(x0), x2: x(x0), y1: y(y0), y2: y(y1) }, svg);

    for (const v of opts.x.ticks) {
      svgEl("text", { class: "fit-tick", x: x(v), y: y(y0) + 16, "text-anchor": "middle" }, svg)
        .textContent = v;
    }
    for (const v of opts.y.ticks) {
      svgEl("text", { class: "fit-tick", x: x(x0) - 8, y: y(v) + 4, "text-anchor": "end" }, svg)
        .textContent = v;
    }
    svgEl("text", {
      class: "fit-axis-label", x: (x(x0) + x(x1)) / 2, y: height - 6, "text-anchor": "middle",
    }, svg).textContent = opts.x.label;
    svgEl("text", {
      class: "fit-axis-label", x: 0, y: 0, "text-anchor": "middle",
      transform: `translate(12 ${(y(y0) + y(y1)) / 2}) rotate(-90)`,
    }, svg).textContent = opts.y.label;

    const clipId = `fit-clip-${++uid}`;
    const clip = svgEl("clipPath", { id: clipId }, svgEl("defs", {}, svg));
    svgEl("rect", { x: x(x0), y: y(y1), width: x(x1) - x(x0), height: y(y0) - y(y1) }, clip);

    return { svg, x, y, width, height, m, clip: `url(#${clipId})` };
  }

  function tooltip(host) {
    return htmlEl("div", "fit-tooltip", host);
  }

  function showTip(tip, host, px, py, text) {
    tip.textContent = text;
    tip.style.left = `${px}px`;
    tip.style.top = `${py}px`;
    tip.classList.toggle("is-left", px > host.clientWidth * 0.6);
    tip.classList.add("is-visible");
  }

  // ---------- chart 1: data + model ----------

  function dataChart(host, { residuals }) {
    let f, line, errors, tip, state;

    function build() {
      f = frame(host, {
        label: "Scatter plot of the data with the model's line",
        x: { domain: X_DOMAIN, ticks: ticks(0, 10, 2), label: "x" },
        y: { domain: Y_DOMAIN, ticks: ticks(0, 24, 4), label: "y" },
      });
      tip = host.querySelector(".fit-tooltip") || tooltip(host);
      errors = DATA.map(() =>
        svgEl("line", { class: "fit-residual", "clip-path": f.clip }, residuals ? f.svg : null));
      line = svgEl("line", { class: "fit-line", "clip-path": f.clip }, f.svg);

      for (const [px, py] of DATA) {
        svgEl("circle", { class: "fit-point", cx: f.x(px), cy: f.y(py), r: 5 }, f.svg);
        const hit = svgEl("circle", { class: "fit-hit", cx: f.x(px), cy: f.y(py), r: 13 }, f.svg);
        hit.addEventListener("pointerenter", () => {
          const pred = state.s * px + state.b;
          const text = residuals
            ? `x = ${px}, y = ${py} · predicted ${fmt(pred, 1)} · error ${fmt(py - pred, 1)}`
            : `x = ${px}, y = ${py}`;
          showTip(tip, host, f.x(px), f.y(py), text);
        });
        hit.addEventListener("pointerleave", () => tip.classList.remove("is-visible"));
      }
      if (state) update(state);
    }

    function update(next) {
      state = next;
      const { s, b } = state;
      const [x0, x1] = X_DOMAIN;
      line.setAttribute("x1", f.x(x0));
      line.setAttribute("y1", f.y(s * x0 + b));
      line.setAttribute("x2", f.x(x1));
      line.setAttribute("y2", f.y(s * x1 + b));
      DATA.forEach(([px, py], i) => {
        errors[i].setAttribute("x1", f.x(px));
        errors[i].setAttribute("x2", f.x(px));
        errors[i].setAttribute("y1", f.y(py));
        errors[i].setAttribute("y2", f.y(s * px + b));
      });
    }

    return { build, update };
  }

  // ---------- chart 2: cost traced along the slope ----------

  function costCurveChart(host) {
    let f, path, guide, dot, state;
    let lo = null;
    let hi = null; // range of slopes the reader has tried so far

    function build() {
      f = frame(host, {
        label: "Cost for each slope tried so far",
        x: { domain: [SLOPE.min, SLOPE.max], ticks: ticks(0, 4, 1), label: "slope" },
        y: { domain: [0, COST_MAX], ticks: ticks(0, 125, 25), label: "cost" },
      });
      path = svgEl("path", { class: "fit-cost-curve", "clip-path": f.clip }, f.svg);
      guide = svgEl("line", { class: "fit-guide" }, f.svg);
      dot = svgEl("circle", { class: "fit-current", r: 6 }, f.svg);
      if (state) update(state);
    }

    function update(next) {
      state = next;
      const { s, b } = state;
      lo = lo === null ? s : Math.min(lo, s);
      hi = hi === null ? s : Math.max(hi, s);

      const steps = Math.max(1, Math.round((hi - lo) / 0.01));
      let d = "";
      for (let i = 0; i <= steps; i++) {
        const v = lo + ((hi - lo) * i) / steps;
        d += `${i ? "L" : "M"}${f.x(v).toFixed(1)},${f.y(cost(v, b)).toFixed(1)}`;
      }
      path.setAttribute("d", d);

      const c = cost(s, b);
      guide.setAttribute("x1", f.x(s));
      guide.setAttribute("x2", f.x(s));
      guide.setAttribute("y1", f.y(0));
      guide.setAttribute("y2", f.y(Math.min(c, COST_MAX)));
      dot.setAttribute("cx", f.x(s));
      dot.setAttribute("cy", f.y(Math.min(c, COST_MAX)));
    }

    return { build, update };
  }

  // ---------- chart 3: cost map over slope and intercept ----------

  function costMapChart(host, onPick) {
    let f, canvas, crossV, crossH, dot, tip, state;

    function paint() {
      const { x, y } = f;
      const left = x(SLOPE.min);
      const top = y(INTERCEPT.max);
      const w = Math.round(x(SLOPE.max) - left);
      const h = Math.round(y(INTERCEPT.min) - top);
      const dpr = window.devicePixelRatio || 1;

      canvas.style.left = `${left}px`;
      canvas.style.top = `${top}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      const ramp = (isDark() ? RAMP.dark : RAMP.light).map((hex) => [
        parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
      ]);
      const corners = [
        cost(SLOPE.min, INTERCEPT.min), cost(SLOPE.min, INTERCEPT.max),
        cost(SLOPE.max, INTERCEPT.min), cost(SLOPE.max, INTERCEPT.max),
      ];
      const lmin = Math.log(MIN_COST_FREE);
      const lmax = Math.log(Math.max(...corners));

      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let j = 0; j < canvas.height; j++) {
        const b = INTERCEPT.max - ((j + 0.5) / canvas.height) * (INTERCEPT.max - INTERCEPT.min);
        for (let i = 0; i < canvas.width; i++) {
          const s = SLOPE.min + ((i + 0.5) / canvas.width) * (SLOPE.max - SLOPE.min);
          const t = (Math.log(cost(s, b)) - lmin) / (lmax - lmin);
          const band = Math.min(ramp.length - 1, Math.max(0, Math.floor(t * ramp.length)));
          const [r, g, bl] = ramp[band];
          const k = (j * canvas.width + i) * 4;
          img.data[k] = r;
          img.data[k + 1] = g;
          img.data[k + 2] = bl;
          img.data[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    function pick(ev) {
      const rect = f.svg.getBoundingClientRect();
      const s = snap(f.x.invert(ev.clientX - rect.left), SLOPE);
      const b = snap(f.y.invert(ev.clientY - rect.top), INTERCEPT);
      onPick(s, b);
    }

    function hover(ev) {
      const rect = f.svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const s = f.x.invert(px);
      const b = f.y.invert(py);
      const inside = s >= SLOPE.min && s <= SLOPE.max && b >= INTERCEPT.min && b <= INTERCEPT.max;
      crossV.style.display = crossH.style.display = inside ? "" : "none";
      if (!inside) {
        tip.classList.remove("is-visible");
        return;
      }
      crossV.setAttribute("x1", px);
      crossV.setAttribute("x2", px);
      crossH.setAttribute("y1", py);
      crossH.setAttribute("y2", py);
      showTip(tip, host, px, py,
        `slope ${fmt(s, 2)} · intercept ${fmt(b, 1)} · cost ${fmt(cost(s, b), 1)}`);
    }

    function build() {
      if (!canvas) canvas = htmlEl("canvas", "fit-map", host);
      f = frame(host, {
        label: "Cost map: cost for every combination of slope and intercept",
        grid: false,
        x: { domain: [SLOPE.min, SLOPE.max], ticks: ticks(0, 4, 1), label: "slope" },
        y: { domain: [INTERCEPT.min, INTERCEPT.max], ticks: ticks(-4, 6, 2), label: "intercept" },
      });
      tip = host.querySelector(".fit-tooltip") || tooltip(host);
      paint();

      crossV = svgEl("line", {
        class: "fit-crosshair", y1: f.y(INTERCEPT.min), y2: f.y(INTERCEPT.max), style: "display:none",
      }, f.svg);
      crossH = svgEl("line", {
        class: "fit-crosshair", x1: f.x(SLOPE.min), x2: f.x(SLOPE.max), style: "display:none",
      }, f.svg);
      dot = svgEl("circle", { class: "fit-current", r: 7 }, f.svg);

      f.svg.classList.add("is-draggable");
      f.svg.addEventListener("pointerdown", (ev) => {
        f.svg.setPointerCapture(ev.pointerId);
        pick(ev);
      });
      f.svg.addEventListener("pointermove", (ev) => {
        if (f.svg.hasPointerCapture(ev.pointerId)) pick(ev);
        hover(ev);
      });
      f.svg.addEventListener("pointerleave", () => {
        crossV.style.display = crossH.style.display = "none";
        tip.classList.remove("is-visible");
      });
      if (state) update(state);
    }

    function update(next) {
      state = next;
      dot.setAttribute("cx", f.x(state.s));
      dot.setAttribute("cy", f.y(state.b));
    }

    return { build, update, repaint: () => f && paint() };
  }

  // ---------- controls ----------

  function slider(parent, label, range, value, onInput) {
    const wrap = htmlEl("label", "fit-slider", parent);
    htmlEl("span", "fit-slider-label", wrap, label);
    const input = htmlEl("input", "", wrap);
    Object.assign(input, { type: "range", min: range.min, max: range.max, step: range.step, value });
    const out = htmlEl("output", "fit-slider-value", wrap, fmt(value, range.digits));
    const paintTrack = () => {
      const pct = ((input.value - range.min) / (range.max - range.min)) * 100;
      input.style.setProperty("--fit-fill", `${pct}%`);
    };
    input.addEventListener("input", () => {
      out.textContent = fmt(+input.value, range.digits);
      paintTrack();
      onInput(+input.value);
    });
    paintTrack();
    return {
      set(v) {
        input.value = v;
        out.textContent = fmt(v, range.digits);
        paintTrack();
      },
    };
  }

  function panel(parent, title) {
    const fig = htmlEl("figure", "fit-panel", parent);
    if (title) htmlEl("figcaption", "fit-panel-title", fig, title);
    return htmlEl("div", "fit-chart", fig);
  }

  // ---------- stages ----------

  function mount(root) {
    const stage = Number(root.dataset.stage);
    const free = stage === 3;
    const state = { s: 0.5, b: free ? 4 : FIXED_INTERCEPT };
    const minCost = free ? MIN_COST_FREE : MIN_COST_FIXED;

    const plots = htmlEl("div", `fit-plots${stage === 1 ? "" : " fit-plots-2"}`, root);
    const charts = [dataChart(panel(plots, stage === 1 ? null : "Data and model"), { residuals: stage > 1 })];
    if (stage === 2) charts.push(costCurveChart(panel(plots, "Cost of each slope you try")));
    let map = null;
    if (stage === 3) {
      const host = panel(plots, "Cost map");
      map = costMapChart(host, (s, b) => {
        state.s = s;
        state.b = b;
        slopeCtl.set(s);
        interceptCtl.set(b);
        refresh();
      });
      charts.push(map);
      const legend = htmlEl("div", "fit-legend", host.parentElement);
      htmlEl("span", "", legend, "Lower cost");
      htmlEl("span", "fit-legend-ramp", legend);
      htmlEl("span", "", legend, "Higher cost");
    }

    const controls = htmlEl("div", "fit-controls", root);
    const sliders = htmlEl("div", "fit-sliders", controls);
    const slopeCtl = slider(sliders, "Slope", SLOPE, state.s, (v) => {
      state.s = v;
      refresh();
    });
    let interceptCtl = null;
    if (free) {
      interceptCtl = slider(sliders, "Intercept", INTERCEPT, state.b, (v) => {
        state.b = v;
        refresh();
      });
    }

    const readout = htmlEl("div", "fit-readout", controls);
    readout.setAttribute("aria-live", "polite");
    const eq = htmlEl("span", "fit-equation", readout);
    let costValue = null;
    if (stage > 1) {
      const c = htmlEl("span", "fit-cost", readout);
      htmlEl("span", "fit-cost-label", c, "Cost");
      costValue = htmlEl("strong", "", c);
    }
    const badge = htmlEl("span", "fit-badge", readout, "✓ Great fit");

    function refresh() {
      const c = cost(state.s, state.b);
      eq.textContent = equation(state.s, state.b);
      if (costValue) costValue.textContent = fmt(c, 2);
      badge.classList.toggle("is-visible", c <= minCost * GOOD_FIT);
      for (const chart of charts) chart.update({ ...state });
    }

    const buildAll = () => {
      for (const chart of charts) chart.build();
      refresh();
    };
    buildAll();

    let lastWidth = root.clientWidth;
    new ResizeObserver(() => {
      if (root.clientWidth !== lastWidth) {
        lastWidth = root.clientWidth;
        buildAll();
      }
    }).observe(root);

    if (map) {
      new MutationObserver(map.repaint).observe(document.body, {
        attributes: true, attributeFilter: ["class"],
      });
    }
  }

  function init() {
    document.querySelectorAll(".fit-demo[data-stage]").forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
