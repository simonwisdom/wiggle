// The figure's look: shaded limbs in the app's blue, orange joints, a soft shadow, and a head you pick.
// Draws from the same 44 numbers a clip frame uses (see clips.js): spine x5, head, near arm x4, far arm x4,
// near leg x4, far leg x4, as [x, y] pairs in the 400 x 300 box, floor at y = 280.
(function (root) {
  // The heads you can pick. "ball" is the plain one and the default.
  const HEADS = [["ball", "Plain"], ["face", "Smiley"], ["beanie", "Beanie"], ["band", "Sweatband"], ["shades", "Sunglasses"],
    ["cat", "Cat"], ["sun", "Sun"], ["robot", "Robot"]];
  const HEAD_KEYS = HEADS.map(([k]) => k);
  const f = (n) => n.toFixed(1);

  // A head in its own space: up is -y and the face looks toward +x (side view), or at you (front view).
  // breath "out" closes the eyes; t (seconds) drives the blink and the small wobbles.
  function headSVG(kind, r, o) {
    const { breath = "in", t = 0, front = false, grad = "" } = o || {};
    const shut = breath === "out" || t % 4.1 < 0.12;
    const eyeAt = (x, y, line) => shut
      ? `<path d="M${f(x - 2.4)} ${f(y)}q2.4 2.2 4.8 0" class="lk-line" style="stroke:${line}"/>`
      : `<circle cx="${f(x)}" cy="${f(y)}" r="2.6" fill="#fff"/><circle cx="${f(front ? x : x + 0.9)}" cy="${f(y)}" r="1.4" fill="#14182b"/>`;
    const eyes = (y, line) => front ? eyeAt(-r * 0.36, y, line) + eyeAt(r * 0.36, y, line) : eyeAt(r * 0.38, y, line);
    const smile = (line) => front
      ? `<path d="M${f(-r * 0.32)} ${f(r * 0.3)}q${f(r * 0.32)} ${f(r * 0.28)} ${f(r * 0.64)} 0" class="lk-line" style="stroke:${line}"/>`
      : `<path d="M${f(r * 0.25)} ${f(r * 0.32)}q${f(r * 0.32)} ${f(r * 0.3)} ${f(r * 0.62)} ${f(-r * 0.08)}" class="lk-line" style="stroke:${line}"/>`;
    const cheeks = front
      ? `<circle cx="${f(-r * 0.55)}" cy="${f(r * 0.18)}" r="${f(r * 0.15)}" class="lk-cheek"/><circle cx="${f(r * 0.55)}" cy="${f(r * 0.18)}" r="${f(r * 0.15)}" class="lk-cheek"/>`
      : `<circle cx="${f(r * 0.12)}" cy="${f(r * 0.22)}" r="${f(r * 0.16)}" class="lk-cheek"/>`;
    const skin = `<circle r="${f(r)}" class="lk-skin"${grad ? ` style="fill:url(#${grad})"` : ""}/>`;
    const face = skin + eyes(-r * 0.18, "#fff") + smile("#fff") + cheeks;
    switch (kind) {
      case "face": return face;
      case "beanie": return face +
        `<path d="M${f(-r - 1.5)} ${f(-r * 0.15)}A${f(r + 1.5)} ${f(r + 1.5)} 0 0 1 ${f(r + 1.5)} ${f(-r * 0.15)}Z" class="lk-warm"/>` +
        `<rect x="${f(-r - 2.5)}" y="${f(-r * 0.32)}" width="${f(2 * r + 5)}" height="${f(r * 0.38)}" rx="3" class="lk-warm-soft"/>` +
        `<circle cx="${front ? 0 : -2}" cy="${f(-r - 3.5 + Math.sin(t * 5) * 0.8)}" r="${f(r * 0.3)}" class="lk-warm-soft"/>`;
      case "band": {
        const sw = Math.sin(t * 2.2) * 3;
        const tails = front ? "" : `<path d="M${f(-r + 1)} ${f(-r * 0.5)}L${f(-r - 9)} ${f(-r * 0.5 + 4 + sw)}M${f(-r + 1)} ${f(-r * 0.44)}L${f(-r - 7)} ${f(-r * 0.2 + 6 - sw)}" class="lk-band" style="stroke-width:3.2"/>`;
        const band = front ? `<path d="M${f(-r * 0.97)} ${f(-r * 0.45)}Q0 ${f(-r * 0.7)} ${f(r * 0.97)} ${f(-r * 0.45)}" class="lk-band"/>`
          : `<path d="M${f(-r * 0.95)} ${f(-r * 0.55)}Q0 ${f(-r * 0.78)} ${f(r * 0.95)} ${f(-r * 0.42)}" class="lk-band"/>`;
        return face + tails + band;
      }
      case "shades": {
        const lens = front
          ? `<rect x="${f(-r * 0.78)}" y="${f(-r * 0.45)}" width="${f(r * 0.66)}" height="${f(r * 0.44)}" rx="3" fill="#14182b"/><rect x="${f(r * 0.12)}" y="${f(-r * 0.45)}" width="${f(r * 0.66)}" height="${f(r * 0.44)}" rx="3" fill="#14182b"/><path d="M${f(-r * 0.12)} ${f(-r * 0.35)}h${f(r * 0.24)}" stroke="#14182b" stroke-width="2"/>`
          : `<rect x="${f(r * 0.05)}" y="${f(-r * 0.48)}" width="${f(r * 1.05)}" height="${f(r * 0.48)}" rx="3" fill="#14182b"/><path d="M${f(r * 0.05)} ${f(-r * 0.36)}L${f(-r * 0.85)} ${f(-r * 0.42)}" stroke="#14182b" stroke-width="2"/><path d="M${f(r * 0.2)} ${f(-r * 0.38)}h${f(r * 0.3)}" stroke="#9db4ff" stroke-width="1.6" stroke-linecap="round"/>`;
        return skin + smile("#fff") + lens;
      }
      case "cat": {
        const ear = (a, b) => `<path d="M${f(a)} ${f(-r * 0.55)}L${f((a + b) / 2)} ${f(-r * 1.45)}L${f(b)} ${f(-r * 0.75)}Z" class="lk-warm" style="stroke:var(--out);stroke-width:2;stroke-linejoin:round"/>`;
        const nose = front ? `<circle cx="0" cy="${f(r * 0.12)}" r="${f(r * 0.13)}" fill="#ff5f7a"/>` : `<circle cx="${f(r * 0.86)}" cy="${f(r * 0.12)}" r="${f(r * 0.13)}" fill="#ff5f7a"/>`;
        const wh = front ? `<path d="M${f(-r * 0.2)} ${f(r * 0.25)}l${f(-r * 0.8)} ${f(-r * 0.08)}M${f(r * 0.2)} ${f(r * 0.25)}l${f(r * 0.8)} ${f(-r * 0.08)}" stroke="#14182b" stroke-width="1" opacity=".6"/>`
          : `<path d="M${f(r * 0.55)} ${f(r * 0.3)}l${f(r * 0.8)} ${f(-r * 0.08)}M${f(r * 0.55)} ${f(r * 0.38)}l${f(r * 0.75)} ${f(r * 0.18)}" stroke="#14182b" stroke-width="1" opacity=".6"/>`;
        return ear(-r * 0.75, -r * 0.05) + ear(r * 0.1, r * 0.8) + `<circle r="${f(r)}" class="lk-warm"/>` + eyes(-r * 0.15, "#14182b") + nose + wh;
      }
      case "sun": {
        let rays = "";
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 0.4, a1 = r + 3, a2 = r + 7.5 + (i % 2) * 2;
          rays += `<path d="M${f(Math.cos(a) * a1)} ${f(Math.sin(a) * a1)}L${f(Math.cos(a) * a2)} ${f(Math.sin(a) * a2)}" stroke="#ffb53d" stroke-width="2.6" stroke-linecap="round"/>`;
        }
        return rays + `<circle r="${f(r)}" fill="#ffc65a"/>` + eyes(-r * 0.18, "#b8530f") + smile("#b8530f") + cheeks;
      }
      case "robot": {
        const bob = Math.sin(t * 3) * 1.5, vx = front ? -r * 0.55 : r * 0.05, vw = front ? r * 1.1 : r * 0.85;
        const scan = shut ? 0 : Math.sin(t * 2) * (vw * 0.3);
        return `<path d="M0 ${f(-r)}L0 ${f(-r - 7)}" stroke="#8ea2e8" stroke-width="2"/><circle cx="0" cy="${f(-r - 8 + bob)}" r="3" class="lk-warm"/>` +
          `<rect x="${f(-r)}" y="${f(-r)}" width="${f(2 * r)}" height="${f(2 * r)}" rx="${f(r * 0.38)}" fill="#dfe6ff" style="stroke:var(--fig-body);stroke-width:2.4"/>` +
          `<rect x="${f(vx)}" y="${f(-r * 0.45)}" width="${f(vw)}" height="${f(r * 0.42)}" rx="3" fill="#14182b"/>` +
          `<rect x="${f(vx + vw / 2 - r * 0.14 + scan)}" y="${f(-r * 0.36)}" width="${f(r * 0.28)}" height="${f(shut ? 1.6 : r * 0.24)}" rx="1" fill="#6ff0c6"/>` +
          `<path d="M${f(front ? -r * 0.3 : r * 0.2)} ${f(r * 0.42)}h${f(r * 0.6)}" style="stroke:var(--fig-body)" stroke-width="2" stroke-dasharray="2 2"/>`;
      }
    }
    return skin;
  }

  // A small picture of a head, for the picker.
  function headIcon(kind) {
    return `<svg viewBox="-24 -26 48 48" aria-hidden="true">${headSVG(kind, 14, {})}</svg>`;
  }

  // The face is drawn looking a quarter turn clockwise from the neck, which is right for a figure facing right.
  // Lying on the back, that would put the face into the floor. Knees bend toward the front of the body, so
  // if the bent knees point the other way, the face turns round. Straight legs say nothing; keep the default.
  function facesBack(P, dx, dy) {
    const fx = -dy, fy = dx;
    let vote = 0;
    for (const a of [14, 18]) {
      const [hx, hy] = P(a), [ex, ey] = P(a + 3);
      const lx = ex - hx, ly = ey - hy, l2 = lx * lx + ly * ly || 1;
      let best = [0, 0], bd = 0;
      for (const k of [a + 1, a + 2]) {
        const [kx, ky] = P(k), u = ((kx - hx) * lx + (ky - hy) * ly) / l2;
        const jx = kx - (hx + u * lx), jy = ky - (hy + u * ly), d = Math.hypot(jx, jy);
        if (d > bd) { bd = d; best = [jx, jy]; }
      }
      if (bd > 6) vote += Math.sign(best[0] * fx + best[1] * fy);
    }
    return vote < 0;
  }

  // Put a figure in el; returns paint(F, {front, breath, t, head}).
  let uid = 0;
  function mount(el, viewBox) {
    const id = "lk" + ++uid;
    el.innerHTML = `<svg class="fg" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<radialGradient id="${id}j" cx=".35" cy=".3"><stop offset="0" style="stop-color:var(--fig-joint-hi)"/><stop offset=".55" style="stop-color:var(--out)"/><stop offset="1" style="stop-color:var(--fig-joint-lo)"/></radialGradient>` +
      `<radialGradient id="${id}h" cx=".35" cy=".3"><stop offset="0" style="stop-color:var(--fig-hi)"/><stop offset=".5" style="stop-color:var(--fig-body)"/><stop offset="1" style="stop-color:var(--fig-edge)"/></radialGradient>` +
      `<filter id="${id}b" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
      `<line class="fg-floor" x1="20" y1="286" x2="380" y2="286"/><g class="lk-fig"></g></svg>`;
    const g = el.querySelector(".lk-fig");
    return function paint(F, o) {
      const { front = false, head = "ball" } = o || {};
      const P = (k) => [F[2 * k], F[2 * k + 1]];
      const path = (a, b) => "M" + Array.from({ length: b - a + 1 }, (_, k) => `${f(F[2 * (a + k)])} ${f(F[2 * (a + k) + 1])}`).join("L");
      const limb = (d, w, far) => `<g${far ? ' class="lk-far"' : ""}><path d="${d}" class="lk-edge" style="stroke-width:${w + 2}"/>` +
        `<path d="${d}" class="lk-body" style="stroke-width:${w - 2}"/><path d="${d}" class="lk-hi" transform="translate(-1.6 -2)" style="stroke-width:${f(w * 0.28)}"/></g>`;
      // a ball on each bend of a limb, skipping points that sit on top of the one before
      const balls = (a, b, rr, far) => {
        let s = "";
        for (let k = a + 1; k < b; k++) {
          const [x, y] = P(k), [px, py] = P(k - 1);
          if (Math.hypot(x - px, y - py) > 3) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="url(#${id}j)"${far ? ' class="lk-far"' : ""}/>`;
        }
        return s;
      };
      const xs = [], W = 12;
      for (let k = 0; k < 22; k++) if (F[2 * k + 1] > 240) xs.push(F[2 * k]);
      let s = "";
      if (xs.length) {
        const lo = Math.min(...xs), hi = Math.max(...xs);
        s += `<ellipse cx="${f((lo + hi) / 2)}" cy="284" rx="${f((hi - lo) / 2 + 16)}" ry="6" class="lk-shadow" filter="url(#${id}b)"/>`;
      }
      // Seen from the side, the far limbs sit back and pale; from the front, all four are near.
      s += limb(path(10, 13), W, !front) + limb(path(18, 21), W, !front) + balls(10, 13, 4.5, !front) + balls(18, 21, 5, !front);
      s += limb(path(0, 4), W + 4, false) + `<circle cx="${f(F[0])}" cy="${f(F[1])}" r="7" fill="url(#${id}j)"/>`;
      s += limb(path(14, 17), W, false) + limb(path(6, 9), W, false) + balls(14, 17, 6, false) + balls(6, 9, 5, false);
      const [nx, ny] = P(4), [hx, hy] = P(5);
      const ang = (Math.atan2(hy - ny, hx - nx) * 180) / Math.PI + 90;
      const r = head === "ball" ? 15 : 16.5;
      const flip = !front && facesBack(P, hx - nx, hy - ny) ? " scale(-1 1)" : "";
      s += `<g transform="translate(${f(hx)} ${f(hy)}) rotate(${f(front ? 0 : ang)})${flip}">${headSVG(head, r, { ...o, grad: head === "ball" ? id + "h" : "" })}</g>`;
      g.innerHTML = s;
    };
  }

  const LOOK = { HEADS, HEAD_KEYS, headSVG, headIcon, mount };
  if (typeof module !== "undefined") module.exports = LOOK;
  else root.LOOK = LOOK;
})(typeof window !== "undefined" ? window : globalThis);
