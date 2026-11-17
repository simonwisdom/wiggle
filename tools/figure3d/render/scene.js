// The 3D scene: the mannequin, the mat and the light, drawn from joint positions.
// Used by index.html (the video render, HyperFrames) and preview.html (still sheets).
// Colours are one setting, here. Wiggle's own: cobalt (--in in public/app.css) and the out-breath orange (--out).
window.FIG3D_COLORS = {
  body: 0x2f5bea,   // limbs, torso, head and hands: Wiggle's cobalt
  joint: 0xff8a3d,  // joint balls: Wiggle's out-breath orange
  mat: 0x6f9296,    // the mat
  panel: "#e9e5df", // the picture's background panel (css colour)
};
window.FIG3D = (function () {
  const V = THREE.Vector3, C = window.FIG3D_COLORS;

  // opts: size (pixels, square), mat {x, z}, head (false = no 3D head: the neck stays, the app draws a head on top),
  // fov (degrees), canvas (an existing canvas, optional)
  function create(opts) {
    const SIZE = opts.size, FOV = opts.fov || 30, MAT = opts.mat || { x: 1.84, z: 0.8 };
    const canvas = opts.canvas || document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 40);
    scene.add(new THREE.HemisphereLight(0xfff8ee, 0x9c9488, 1.25));
    const key = new THREE.DirectionalLight(0xfff1df, 2.9);
    key.position.set(2.6, 5.2, 3.8); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 1, far: 14 });
    key.shadow.radius = 7; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe9ff, 1.1); rim.position.set(-3.5, 2.8, -4); scene.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    { // the mat
      const w = MAT.x, h = MAT.z, r = 0.04, sh = new THREE.Shape();
      sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2);
      sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const mat = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false, curveSegments: 8 }), new THREE.MeshStandardMaterial({ color: C.mat, roughness: 0.95 }));
      mat.rotation.x = -Math.PI / 2; mat.position.y = 0.001; mat.receiveShadow = true; scene.add(mat);
    }

    const bodyMat = new THREE.MeshStandardMaterial({ color: C.body, roughness: 0.55 });
    const jointMat = new THREE.MeshStandardMaterial({ color: C.joint, roughness: 0.5 });
    const fig = new THREE.Group(); scene.add(fig);
    const UP = new V(0, 1, 0), pv = {}, updaters = [];
    const JOINTS = opts.joints;
    for (const n of JOINTS) pv[n] = new V();
    const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; fig.add(o); return o; };
    function limb(a, b, r0, r1, bulge, at) {
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new THREE.Vector2(r0 + (r1 - r0) * u + bulge * Math.sin(Math.PI * Math.pow(u, at || 1)), u)); }
      const m = mesh(new THREE.LatheGeometry(pts, 28), bodyMat), d = new V();
      updaters.push(() => { d.subVectors(pv[b], pv[a]); const l = d.length() || 1e-4; m.position.copy(pv[a]); m.quaternion.setFromUnitVectors(UP, d.divideScalar(l)); m.scale.set(1, l, 1); });
    }
    const ball = (a, r, m) => { const o = mesh(new THREE.SphereGeometry(r, 28, 20), m || jointMat); updaters.push(() => o.position.copy(pv[a])); };
    function egg(a, b, off, rx, ry, rz) {
      const m = mesh(new THREE.SphereGeometry(1, 32, 24), bodyMat), d = new V();
      updaters.push(() => { d.subVectors(pv[b], pv[a]).normalize(); m.quaternion.setFromUnitVectors(UP, d); m.position.copy(pv[a]).addScaledVector(d, off); m.scale.set(rx, ry, rz); });
      return m;
    }
    for (const s of ["l", "r"]) {
      limb(s + "Hip", s + "Knee", 0.08, 0.054, 0.008); limb(s + "Knee", s + "Ankle", 0.05, 0.036, 0.012, 0.6);
      limb(s + "Ankle", s + "Toe", 0.042, 0.03, 0.004);
      limb(s + "Sh", s + "El", 0.05, 0.039, 0.005); limb(s + "El", s + "Wr", 0.038, 0.028, 0.007, 0.6);
      ball(s + "Hip", 0.082, bodyMat); ball(s + "Knee", 0.055); ball(s + "Ankle", 0.04); ball(s + "Toe", 0.03, bodyMat);
      ball(s + "Sh", 0.058); ball(s + "El", 0.04); ball(s + "Wr", 0.03);
      egg(s + "Wr", s + "Hand", 0.075, 0.036, 0.085, 0.03);
    }
    limb("neck", "head", 0.05, 0.044, 0); ball("neck", 0.056, bodyMat);
    const headMesh = egg("head", "headEnd", 0.075, 0.09, 0.118, 0.1);
    if (opts.head === false) { headMesh.visible = false; ball("head", 0.046, bodyMat); } // a rounded neck end under the app's head

    // the torso: a skin lofted along the spine, so a rounded or arched back shows
    const ST = [[0.15, 0.1, 0], [0.16, 0.108, 0], [0.148, 0.104, 0.2], [0.138, 0.1, 0.5], [0.158, 0.108, 0.8], [0.152, 0.096, 1], [0.062, 0.056, 1]];
    const RINGS = 40, SEG = 28, CAP = [[0.022, 0.92], [0.05, 0.7], [0.068, 0.36], [0.074, 0.02]];
    const tGeo = new THREE.BufferGeometry(), nR = RINGS + CAP.length, tPos = new Float32Array(nR * SEG * 3), tIdx = [];
    for (let i = 0; i < nR - 1; i++) for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + (j + 1) % SEG, c = a + SEG, d = b + SEG;
      tIdx.push(a, c, b, b, c, d);
    }
    tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3)); tGeo.setIndex(tIdx);
    const torsoMesh = mesh(tGeo, bodyMat); torsoMesh.frustumCulled = false;
    const ctrl = [0, 1, 2, 3, 4, 5, 6].map(() => new V()), curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
    const Lh = new V(), Ls = new V(), L = new V(), T = new V(), F = new V(), Cc = new V();
    function ring(row, c, l, f, w, d) {
      for (let j = 0; j < SEG; j++) {
        const th = (j / SEG) * Math.PI * 2, cx = Math.cos(th) * w, sx = Math.sin(th) * d, o = (row * SEG + j) * 3;
        tPos[o] = c.x + l.x * cx + f.x * sx; tPos[o + 1] = c.y + l.y * cx + f.y * sx; tPos[o + 2] = c.z + l.z * cx + f.z * sx;
      }
    }
    function updateTorso() {
      ctrl[0].addVectors(pv.lHip, pv.rHip).multiplyScalar(0.5); ctrl[1].copy(pv.pelvis); ctrl[2].copy(pv.s1); ctrl[3].copy(pv.s2); ctrl[4].copy(pv.s3);
      ctrl[5].addVectors(pv.lSh, pv.rSh).multiplyScalar(0.5); ctrl[6].copy(pv.neck);
      ctrl[1].lerpVectors(ctrl[0], ctrl[2], 0.5);
      Lh.subVectors(pv.lHip, pv.rHip).normalize(); Ls.subVectors(pv.lSh, pv.rSh).normalize();
      for (let i = 0; i < RINGS; i++) {
        const t = i / (RINGS - 1), k = t * 6, k0 = Math.min(5, Math.floor(k)), a = k - k0;
        const w = ST[k0][0] + (ST[k0 + 1][0] - ST[k0][0]) * a, d = ST[k0][1] + (ST[k0 + 1][1] - ST[k0][1]) * a, m = ST[k0][2] + (ST[k0 + 1][2] - ST[k0][2]) * a;
        curve.getPoint(t, Cc); curve.getTangent(t, T);
        L.copy(Lh).lerp(Ls, m); L.addScaledVector(T, -L.dot(T)).normalize(); F.crossVectors(L, T);
        Cc.addScaledVector(F, 0.022 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
        ring(CAP.length + i, Cc, L, F, w, d);
        if (i === 0) for (let c = 0; c < CAP.length; c++) { const [off, sc] = CAP[c]; ring(CAP.length - 1 - c, Cc.clone().addScaledVector(T, -off), L, F, w * sc, d * sc); }
      }
      tGeo.attributes.position.needsUpdate = true; tGeo.computeVertexNormals();
    }

    return {
      canvas, camera, renderer, three: THREE,
      // P: joint positions, flat [x, y, z, ...] in JOINTS order
      draw(P) {
        for (let j = 0; j < JOINTS.length; j++) pv[JOINTS[j]].set(P[j * 3], P[j * 3 + 1], P[j * 3 + 2]);
        for (const u of updaters) u();
        updateTorso();
      },
      // cam: { az, el, dist, target: [x, y, z] }, the same numbers cameras.mjs projects with
      setCamera(cam) {
        const az = (cam.az * Math.PI) / 180, el = (cam.el * Math.PI) / 180, t = cam.target;
        camera.position.set(t[0] + Math.sin(az) * Math.cos(el) * cam.dist, t[1] + Math.sin(el) * cam.dist, t[2] + Math.cos(az) * Math.cos(el) * cam.dist);
        camera.lookAt(t[0], t[1], t[2]); camera.updateMatrixWorld();
      },
      render() { renderer.render(scene, camera); },
    };
  }
  return { create };
})();
