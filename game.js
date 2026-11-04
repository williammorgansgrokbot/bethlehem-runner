import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const Q = new URLSearchParams(location.search);
const GOD = Q.has('god');
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const LANES = [-2.2, 0, 2.2];
const OUTLINE = [0x3a / 255, 0x1d / 255, 0x08 / 255];

// ---------- Renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const MAX_PIX = IS_MOBILE ? 4.2e6 : 8.3e6;
const safePR = (base) => Math.max(1, Math.min(base, Math.sqrt(MAX_PIX / Math.max(1, innerWidth * innerHeight))));
let pixelRatio = safePR(Math.min(devicePixelRatio || 1, IS_MOBILE ? 2 : 3));
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const outline = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: OUTLINE, defaultAlpha: 1 });
let useOutline = true;

const scene = new THREE.Scene();
const FOG_COL = new THREE.Color(0x24305e);
scene.background = new THREE.Color(0x0b1636);
scene.fog = new THREE.Fog(FOG_COL, 75, 240);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 4.2, 7.5);

// ---------- Textures ----------
const loader = new THREE.TextureLoader();
const aniso = renderer.capabilities.getMaxAnisotropy();
const NAMES_ALL = ['tex_sandstone.jpg', 'tex_cobble.jpg', 'tex_facade1.jpg', 'tex_facade2.jpg', 'bg_bethlehem.jpg', ...['run0', 'run1', 'jump', 'slide', 'coin', 'scroll', 'lamp', 'sandals', 'shield', 'magnet', 'camel', 'donkey', 'cart', 'baskets', 'olive', 'palm', 'stall', 'pots', 'stable', 'gabriel', 'inn', 'shepherds', 'magi', 'finale'].map(n => n + '.png')];
const CACHE = {};
await Promise.all(NAMES_ALL.map(async n => { CACHE[n] = await loader.loadAsync('assets/' + n); }));
function load(name, rx = 1, ry = 1) {
  const t = CACHE[name]; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  return t;
}
function makeCanvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function cloth(c1, c2) {
  const t = new THREE.CanvasTexture(makeCanvas(256, (g, s) => {
    for (let x = 0; x < s; x += 32) { g.fillStyle = (x / 32) % 2 ? c1 : c2; g.fillRect(x, 0, 32, s); }
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < s; x += 32) g.fillRect(x + 4, 0, 6, s);
    g.fillStyle = 'rgba(58,29,8,.25)'; g.fillRect(0, s - 18, s, 18);
  })); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1); return t;
}
const TX = {
  sand: load('tex_sandstone.jpg', 1, 1), cobble: load('tex_cobble.jpg', 3, 80),
  facades: [load('tex_facade1.jpg'), load('tex_facade2.jpg')], bg: load('bg_bethlehem.jpg'),
};
const SPR = {};
for (const n of ['run0', 'run1', 'jump', 'slide', 'coin', 'scroll', 'lamp', 'sandals', 'shield', 'magnet', 'camel', 'donkey', 'cart', 'baskets', 'olive', 'palm', 'stall', 'pots', 'stable', 'gabriel', 'inn', 'shepherds', 'magi', 'finale']) SPR[n] = load(n + '.png');
function sandTex(w, h) { const t = TX.sand.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, w / 3.5), Math.max(1, h / 3.5)); t.needsUpdate = true; return t; }

// Toon gradient (soft 3-band painted shading)
const grad = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: grad, ...o });
const noOutline = m => { m.userData.outlineParameters = { visible: false }; return m; };

// ---------- Materials ----------
const M = {
  sand: toon({ map: sandTex(4, 4) }),
  sandW: toon({ map: sandTex(4, 4), color: 0xfff4e0 }),
  sandD: toon({ map: sandTex(4, 2), color: 0xf0cf98 }),
  ground: toon({ map: TX.cobble, color: 0xc4bcd8 }),
  wood: toon({ color: 0xc98a4b }), darkWood: toon({ color: 0x6b4a2e }),
  cloths: [cloth('#ff6040', '#fff4cf'), cloth('#3f7fc9', '#fff4cf'), cloth('#ffd34d', '#ff7a7a'), cloth('#5aa86a', '#ffe066')].map(t => toon({ map: t, side: THREE.DoubleSide })),
  gold: toon({ color: 0xffd34d, emissive: 0x6a3c00, emissiveIntensity: 0.3 }),
  lantern: noOutline(new THREE.MeshBasicMaterial({ color: 0xffe066 })),
  rope: new THREE.LineBasicMaterial({ color: 0x6b4a2e }),
};
function spriteMat(tex) { return noOutline(new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, fog: true, toneMapped: false })); }
const planeG = new THREE.PlaneGeometry(1, 1); planeG.translate(0, 0.5, 0);
const planeC = new THREE.PlaneGeometry(1, 1);
// billboard of given height (keeps texture aspect once loaded)
function billboard(name, h, parent, x = 0, z = 0, center = false) {
  const m = new THREE.Mesh(center ? planeC : planeG, spriteMat(SPR[name])); m.castShadow = true;
  const img = SPR[name].image; const asp = img && img.width ? img.width / img.height : 0.75;
  m.scale.set(h * asp, h, 1); m.userData.h = h; m.position.set(x, 0, z);
  if (!img || !img.width) SPR[name].onUpdate = () => { const i = SPR[name].image; m.scale.x = h * i.width / i.height; };
  billboards.push(m); if (parent) parent.add(m); return m;
}
const billboards = [];
function fixAspects() { for (const m of billboards) { const i = m.material.map.image; if (i && i.width) m.scale.x = m.userData.h * i.width / i.height; } }

// ---------- Lighting ----------
const sunDir = new THREE.Vector3(-0.5, 0.75, 0.45).normalize();
scene.add(new THREE.HemisphereLight(0x8a98d8, 0x4a3a50, 0.95));
const sun = new THREE.DirectionalLight(0xffe6c0, 1.05); // warm starlight
const warmFill = new THREE.DirectionalLight(0xff9a50, 0.45); warmFill.position.set(0.6, 0.4, 1); scene.add(warmFill); // window/lantern bounce
sun.castShadow = true;
sun.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 140;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
scene.add(sun, sun.target);
sun.target.position.set(0, 0, -20); sun.position.copy(sun.target.position).addScaledVector(sunDir, 60);

// ---------- Painted backdrop (Jerusalem + Temple) ----------
const skyMat = noOutline(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec3 vP; void main(){ float h=vP.y; vec3 c=mix(vec3(.20,.24,.48), vec3(.03,.07,.20), smoothstep(0.,.45,h)); gl_FragColor=vec4(pow(c,vec3(2.2)),1.); }` }));
const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 12), skyMat); scene.add(sky);
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(560, 315), noOutline(new THREE.MeshBasicMaterial({ map: TX.bg, fog: false, toneMapped: false })));
backdrop.scale.set(1.5, 1.12, 1); backdrop.position.set(0, 112, -330); sky.renderOrder = -2; scene.add(backdrop);
// ---------- Star of Bethlehem (big, glowing, rayed) ----------
const starTex = new THREE.CanvasTexture(makeCanvas(1024, (g, s) => {
  const c = s / 2;
  let gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.06, 'rgba(255,236,170,.95)'); gr.addColorStop(0.22, 'rgba(255,205,110,.35)'); gr.addColorStop(0.5, 'rgba(255,190,90,.08)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  g.globalCompositeOperation = 'lighter';
  const ray = (ang, len, w, a) => { g.save(); g.translate(c, c); g.rotate(ang); const lg = g.createLinearGradient(0, 0, len, 0); lg.addColorStop(0, `rgba(255,248,215,${a})`); lg.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore(); };
  for (let k = 0; k < 4; k++) ray(k * Math.PI / 2 - Math.PI / 2, k === 2 ? c * 0.98 : c * 0.82, 16, 1);
  for (let k = 0; k < 4; k++) ray(k * Math.PI / 2 + Math.PI / 4, c * 0.45, 9, 0.8);
  for (let k = 0; k < 16; k++) ray(k * Math.PI / 8 + 0.2, c * (0.25 + Math.random() * 0.2), 3, 0.45);
}));
starTex.colorSpace = THREE.SRGBColorSpace;
const starMat = new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
const star = new THREE.Sprite(starMat); star.scale.set(175, 175, 1); star.position.set(0, 100, -318); star.renderOrder = 5; scene.add(star);
const starHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, color: 0x5a6ab8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.0 }));
// twinkling background stars
{ const N = 500, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const th = rand(-1.2, 1.2), ph = rand(0.18, 1.2); pos[i * 3] = Math.sin(th) * 650 * Math.cos(ph); pos[i * 3 + 1] = Math.sin(ph) * 650; pos[i * 3 + 2] = -Math.cos(th) * 650 * Math.cos(ph); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var skyStars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff6dc, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })); skyStars.renderOrder = -1; scene.add(skyStars); }

// ---------- Ground ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 300), M.ground);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -130); ground.receiveShadow = true; scene.add(ground);
const sideGround = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), noOutline(toon({ color: 0x8e98c4 })));
sideGround.rotation.x = -Math.PI / 2; sideGround.position.set(0, -0.02, -200); sideGround.receiveShadow = true; scene.add(sideGround);
for (const s of [-1, 1]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 300), M.sandD); g.position.set(s * 4.85, 0.11, -130); g.receiveShadow = true; scene.add(g); }

// ---------- Helpers ----------
function mesh(geo, mat, x = 0, y = 0, z = 0, parent, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m); return m;
}
const G = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(0.5, 16, 12) };
function rbox(w, h, d, r = 0.12) { // chunky rounded box
  const sh = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: d - 2 * r, bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  // planar UVs by world size
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); uv.setXY(i, ax > 0.5 ? p.getZ(i) / 3.5 : p.getX(i) / 3.5, ay > 0.5 ? p.getZ(i) / 3.5 : p.getY(i) / 3.5); }
  return g;
}
function boxM(w, h, d, mat, x, y, z, p, sh = true, r) { return mesh(rbox(w, h, d, r ?? Math.min(0.15, Math.min(w, h, d) * 0.25)), mat, x, y, z, p, sh); }

// ---------- Christmas decorations ----------
const XM = {
  green: toon({ color: 0x2f7a3e }), greenD: toon({ color: 0x1f5a2c }), red: toon({ color: 0xd8322a, emissive: 0x400000, emissiveIntensity: 0.4 }),
  snow: toon({ color: 0xf4f7ff }),
  window: noOutline(new THREE.MeshBasicMaterial({ color: 0xffc35a, toneMapped: false })),
  windowFrame: toon({ color: 0x5a3a22 }),
  bulbs: [0xff4a3a, 0xffd34d, 0x4ad06a, 0x5ab0ff, 0xfff2c0].map(c => noOutline(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))),
  glowMats: {},
};
const bulbG = new THREE.SphereGeometry(0.09, 8, 6), berryG = new THREE.SphereGeometry(0.07, 6, 4);
function glowSprite(col, sz) { let m = XM.glowMats[col]; if (!m) m = XM.glowMats[col] = new THREE.SpriteMaterial({ map: glowTex(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }); const sp = new THREE.Sprite(m); sp.scale.setScalar(sz); return sp; }
function garland(p, pts, bulbs = true, berries = true) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.14, 6, false), XM.green); tube.castShadow = true; p.add(tube);
  const n = Math.round(curve.getLength() / 0.55);
  for (let i = 1; i < n; i++) { const q = curve.getPoint(i / n);
    if (bulbs) { const b = new THREE.Mesh(bulbG, XM.bulbs[i % 5]); b.position.copy(q); b.position.y -= 0.14; p.add(b); if (i % 2 === 0) { const gs = glowSprite(XM.bulbs[i % 5].color.getHex(), 0.55); gs.position.copy(b.position); p.add(gs); } }
    else if (berries && i % 2) { const b = new THREE.Mesh(berryG, XM.red); b.position.copy(q); p.add(b); } }
}
function wreath(p, x, y, z, side, r = 0.62) {
  const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; p.add(w);
  const t = mesh(new THREE.TorusGeometry(r, r * 0.32, 8, 22), XM.green, 0, 0, 0, w); 
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const b = mesh(berryG, XM.red, Math.cos(a) * r, Math.sin(a) * r, r * 0.3, w, false); b.scale.setScalar(1.3); }
  const bow = mesh(new THREE.SphereGeometry(0.18, 10, 8), XM.red, 0, -r, r * 0.32, w); bow.scale.set(1.8, 1, 0.7);
  for (const s of [-1, 1]) { const tail = mesh(G.box, XM.red, s * 0.12, -r - 0.32, r * 0.3, w); tail.scale.set(0.12, 0.45, 0.05); tail.rotation.z = s * 0.3; }
}
function xmasDecor(g, side, h, d) {
  const fx = side * 5.08; // street-facing wall plane
  // warm glowing windows (two floors)
  const rot = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  for (const wy of [h * 0.42, h * 0.72]) for (const wz of [-d * 0.28, d * 0.28]) {
    if (Math.random() < 0.25) continue;
    const fr = mesh(G.box, XM.windowFrame, fx, wy, wz, g); fr.scale.set(0.1, 1.5, 1.05);
    const wi = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.28), XM.window); wi.position.set(fx - side * 0.07, wy, wz); wi.rotation.y = rot; g.add(wi);
    const gl = glowSprite(0xff9a30, 2.0); gl.position.set(fx - side * 0.35, wy, wz); g.add(gl);
    const sill = mesh(G.box, XM.snow, fx - side * 0.12, wy - 0.74, wz, g); sill.scale.set(0.3, 0.1, 1.2);
  }
  // garland swag with string lights along the roofline
  const ry = h - 0.25, pts = [];
  for (let i = 0; i <= 8; i++) { const z = -d / 2 + 0.3 + i * (d - 0.6) / 8; pts.push(new THREE.Vector3(fx - side * 0.2, ry - Math.abs(Math.sin(i * Math.PI / 2)) * 0.55, z)); }
  garland(g, pts, true);
  // snow cap on the parapet
  const cap = mesh(G.box, XM.snow, side * (5.1 + 3.5), h + 0.45, 0, g); cap.scale.set(7.3, 0.14, d + 0.5);
  // wreath on the door level
  if (Math.random() < 0.75) wreath(g, fx - side * 0.12, h * 0.2 + 1.2, rand(-d * 0.15, d * 0.15), side);
}
// ---------- Street decor ----------
const SEG_LEN = 14, SEG_N = 15;
const houseSand = toon({ map: (() => { const t = sandTex(1, 1); t.repeat.set(2.6, 2.6); return t; })(), color: 0xa8a8d4 }), houseSandW = toon({ map: houseSand.map, color: 0xbcb8dc });
const sideMats = [houseSand, houseSandW, houseSand];
function buildHouse(side) {
  const g = new THREE.Group();
  const h = rand(7, 10), d = Math.min(12.5, h * rand(0.95, 1.15)), w = 7;
  const bx = side * (5.1 + w / 2);
  const facade = toon({ map: pick(TX.facades), color: 0xb4b2d8 }); // moonlit tint
  const s = pick(sideMats);
  // box material order: +x,-x,+y,-y,+z,-z -> street face is -x for right side, +x for left side
  const mats = [s, s, s, s, s, s]; mats[side > 0 ? 1 : 0] = facade;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); body.position.set(bx, h / 2, 0); body.castShadow = body.receiveShadow = true; g.add(body);
  if (side > 0) { /* mirror facade on -x face so it reads correctly */ }
  boxM(w + 0.4, 0.4, d + 0.4, M.sandD, bx, h + 0.2, 0, g);
  if (Math.random() < 0.35) { const dm = mesh(new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.sandW, bx, h + 0.4, 0, g); }
  xmasDecor(g, side, h, d);
  return g;
}
function buildDecor(side, kind) {
  const g = buildHouse(side);
  const x = side * 4.75;
  if (kind === 'olive') billboard('olive', 4.6, g, side * 5.6, rand(-3, 3));
  if (kind === 'palm') billboard('palm', 6.5, g, side * 5.4, rand(-3, 3));
  if (kind === 'stall') billboard('stall', 3.2, g, x - side * 0.1, rand(-2, 2));
  if (kind === 'pots') billboard('pots', 1.5, g, x, rand(-4, 4));
  return g;
}
function buildArch(gate) {
  const g = new THREE.Group();
  const mat = gate ? M.sandD : M.sand;
  const pw = gate ? 2.6 : 1.2, ph = gate ? 5.5 : 4.4;
  for (const s of [-1, 1]) {
    boxM(pw, ph, gate ? 3 : 1.4, mat, s * (4.6 + pw / 2), ph / 2, 0, g);
    if (gate) { boxM(pw + 0.6, 4.5, 3.6, mat, s * (4.6 + pw / 2), ph + 2.25, 0, g); for (let k = -1; k <= 1; k++) boxM(0.7, 0.9, 0.7, mat, s * (4.6 + pw / 2) + k * 1.1, ph + 4.9, 1.4, g); }
  }
  const ring = mesh(new THREE.TorusGeometry(4.75, gate ? 0.75 : 0.5, 10, 32, Math.PI), mat, 0, ph, 0, g); ring.scale.z = gate ? 3.5 : 2.6;
  boxM(10.8 + (gate ? 4 : 0), gate ? 2.2 : 1.3, gate ? 3 : 1.4, mat, 0, ph + 4.75 + (gate ? 0.9 : 0.45), 0, g);
  if (gate) { for (let x = -6.6; x <= 6.6; x += 1.32) boxM(0.6, 0.7, 0.8, mat, x, ph + 6.4, 1.1, g); }
  const l = mesh(G.sph, M.lantern, 0, ph + (gate ? 3.2 : 3.6), gate ? 1.8 : 0.8, g, false); l.scale.setScalar(0.4);
  { const lg = glowSprite(0xffb050, 2.4); lg.position.copy(l.position); g.add(lg); }
  // garland draped over the arch + wreath
  { const pts = []; for (let i = 0; i <= 12; i++) { const a = Math.PI - i / 12 * Math.PI; pts.push(new THREE.Vector3(Math.cos(a) * 4.75, ph + Math.sin(a) * 4.75, (gate ? 1.75 : 0.75) + 0.2)); } garland(g, pts, true); }
  if (gate) { const w = new THREE.Group(); w.rotation.y = 0; g.add(w); wreath(w, 0, ph + 6.6, 1.9, 0); w.children[0].rotation.y = 0; }
  return g;
}
function buildBanners() {
  const g = new THREE.Group(); const y = rand(6, 7.5);
  const pts = []; for (let i = 0; i <= 12; i++) { const x = -5 + i * 10 / 12; pts.push(new THREE.Vector3(x, y - Math.sin(i / 12 * Math.PI) * 0.8, 0)); }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.rope));
  const tri = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0, -0.7, 0)]); tri.computeVertexNormals();
  const cols = [0xd8322a, 0x2f7a3e, 0xffd34d, 0xf4f7ff, 0x2f7a3e].map(c => noOutline(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })));
  for (let i = 1; i < 12; i++) { const f = new THREE.Mesh(tri, cols[i % cols.length]); f.position.copy(pts[i]); f.castShadow = true; g.add(f);
    const b = new THREE.Mesh(bulbG, XM.bulbs[i % 5]); b.position.copy(pts[i]).add(new THREE.Vector3(0.0, 0.08, 0.05)); g.add(b); const gs = glowSprite(XM.bulbs[i % 5].color.getHex(), 0.7); gs.position.copy(b.position); g.add(gs); }
  return g;
}
const segments = []; let gateCounter = 0;
const decorRoot = new THREE.Group(); scene.add(decorRoot);
const KINDS = ['none', 'olive', 'stall', 'palm', 'pots'];
for (let i = 0; i < SEG_N; i++) {
  const seg = { g: new THREE.Group(), L: [], R: [], arch: buildArch(false), gate: buildArch(true), banner: buildBanners() };
  for (const [arr, s] of [[seg.L, -1], [seg.R, 1]]) { for (const k of KINDS) arr.push(buildDecor(s, k)); arr.forEach(o => seg.g.add(o)); }
  seg.g.add(seg.arch, seg.gate, seg.banner);
  seg.g.position.z = 10 - i * SEG_LEN;
  randomizeSeg(seg, i < 2);
  decorRoot.add(seg.g); segments.push(seg);
}
function randomizeSeg(seg, plain) {
  const a = (Math.random() * KINDS.length) | 0, b = (Math.random() * KINDS.length) | 0;
  seg.a = a; seg.b = b; seg.L.forEach((o, k) => o.visible = k === a); seg.R.forEach((o, k) => o.visible = k === b);
  gateCounter++;
  const gate = !plain && gateCounter % 18 === 0;
  seg.gate.visible = gate; seg.arch.visible = !gate && !plain && Math.random() < 0.14;
  seg.banner.visible = !gate && !seg.arch.visible && Math.random() < 0.4;
}

// ---------- Nativity stable set piece (distance milestones) ----------
// The Christmas story told along the road, in order, then repeating every STORY_CYCLE miles.
const STORY = [
  { key: 'gabriel', at: 300, h: 7.4, title: 'The angel visits Mary', verse: '“Do not be afraid, Mary. God is very pleased with you … You must call him Jesus.”', ref: 'Luke 1:30-31', bonus: 400, coins: 10, star: false },
  { key: 'inn', at: 600, h: 8.0, title: 'No room at the inn', verse: '“She placed him in a manger. That’s because there was no guest room where they could stay.”', ref: 'Luke 2:7', bonus: 500, coins: 10, star: false },
  { key: 'shepherds', at: 900, h: 8.2, title: 'Good news for the shepherds!', verse: '“Do not be afraid. I bring you good news. It will bring great joy for all the people.”', ref: 'Luke 2:10', bonus: 600, coins: 15, star: false },
  { key: 'stable', at: 1200, h: 8.2, title: 'You reached the stable!', verse: '“Today in the town of David a Savior has been born to you.”', ref: 'Luke 2:11', bonus: 1000, coins: 25, star: true },
  { key: 'magi', at: 1500, h: 7.6, title: 'The Wise Men follow the star', verse: '“When they saw the star, they were filled with joy … They gave him gold, frankincense and myrrh.”', ref: 'Matthew 2:10-11', bonus: 800, coins: 20, star: true },
];
const STORY_CYCLE = 1500, STABLE_SPAWN_Z = -200, STORY_LEAD = 190;
const STORY_MODE_AT = [200, 430, 660, 890, 1120], STORY_SPEED = 15; // Story Mode: closer scenes, gentle constant speed, ends after the Wise Men
function storyAt(i) { const n = STORY.length; if (S.story) return { sc: STORY[Math.min(i, n - 1)], d: i < n ? STORY_MODE_AT[i] : Infinity }; return { sc: STORY[i % n], d: Math.floor(i / n) * STORY_CYCLE + STORY[i % n].at }; }
function storyIndexFrom(d) { let i = 0; while (storyAt(i).d - STORY_LEAD < d) i++; return i; }
const stable = { g: new THREE.Group(), active: false, z: 0, side: 1, reached: false, idx: 0, sc: STORY[3], sprs: {} };
{
  const g = stable.g; g.visible = false; scene.add(g);
  for (const sc of STORY) { const m = billboard(sc.key, sc.h, g, 0, 0); m.castShadow = true; m.visible = false; stable.sprs[sc.key] = m; }
  stable.spr = stable.sprs.stable;
  // glowing straw / lantern warmth
  const straw = glowSprite(0xffc04a, 3.6); straw.position.set(0, 1.5, 0.6); g.add(straw); stable.straw = straw;
  const warm = glowSprite(0xff9a30, 6); warm.position.set(0, 3, 0.3); g.add(warm); stable.warm = warm;
  // star directly above + beam of light
  const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); st.scale.set(16, 16, 1); st.position.set(0, 21, 0); g.add(st); stable.star = st;
  const beamG = new THREE.CylinderGeometry(0.35, 2.2, 14, 32, 1, true); beamG.translate(0, 7 + 7.5, 0);
  const col = new Float32Array(beamG.attributes.position.count * 3); for (let i = 0; i < beamG.attributes.position.count; i++) { const t = (beamG.attributes.position.getY(i) - 7.5) / 14; const v = 0.25 + 0.75 * t; col[i * 3] = 1 * v; col[i * 3 + 1] = 0.9 * v; col[i * 3 + 2] = 0.6 * v; }
  beamG.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const beam = new THREE.Mesh(beamG, noOutline(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  g.add(beam); stable.beam = beam;
}
function spawnStable() { if (!S.story) for (const o of obstacles) if (o.z < -55) { o.g.visible = false; o.z = 99; }
  const { sc } = storyAt(stable.idx); stable.sc = sc; for (const k in stable.sprs) stable.sprs[k].visible = k === sc.key; stable.spr = stable.sprs[sc.key];
  stable.star.visible = stable.beam.visible = sc.star; stable.straw.visible = stable.warm.visible = sc.key === 'stable' || sc.key === 'inn';
  stable.active = true; stable.reached = false; stable.side = Math.random() < 0.5 ? -1 : 1; stable.z = STABLE_SPAWN_Z; stable.g.position.set(stable.side * 8.0, 0, stable.z); stable.spr.userData.fixed = -stable.side * 0.45; stable.g.visible = true; }
function hideStable() { stable.active = false; stable.g.visible = false; for (const seg of segments) { seg.L.forEach((o, k) => o.visible = k === seg.a); seg.R.forEach((o, k) => o.visible = k === seg.b); } }
function updateStable(dz, t) {
  if (!stable.active) return;
  stable.z += dz; stable.g.position.z = stable.z;
  // clear the houses on that side of the street so the stable sits roadside
  for (const seg of segments) { const sz = seg.g.position.z; const near = sz > stable.z - 11 && sz < Math.max(stable.z + 11, stable.z < -8 ? 30 : -99); if (near) { seg.arch.visible = seg.gate.visible = seg.banner.visible = false; } const arr = stable.side < 0 ? seg.L : seg.R, k0 = stable.side < 0 ? seg.a : seg.b; arr.forEach((o, k) => o.visible = k === k0 && !near); }
  stable.straw.material.opacity = 0.6 + Math.sin(t * 3) * 0.15; stable.beam.material.opacity = 0.18 + Math.sin(t * 1.7) * 0.04;
  const tw = 16 * (1 + Math.sin(t * 4) * 0.06); stable.star.scale.set(tw, tw, 1);
  if (!stable.reached && stable.z > -1 && S.state === 'play' && !S.dead) { stable.reached = true; reachStable(); }
  if (stable.z > 30) hideStable();
}
function reachStable() {
  const sc = stable.sc, bonus = sc.bonus * S.mult; S.score += bonus; S.coins += sc.coins;
  Sfx.power(); Sfx.narrate(sc); emit(stable.side * 5, 3, -1, 80, 0xffe066, 9, 0.6, 1.2, 3);
  const b = $('banner'); b.innerHTML = `<b>${sc.title}</b><span>${sc.verse} ${sc.ref} (NIrV)</span><i>+${bonus.toLocaleString()} &bull; +${sc.coins} coins</i>`;
  b.classList.add('show'); bannerT = S.story ? 9 : 7;
}
let bannerT = 0;
// ---------- Story Mode finale: full nativity scene, ride slows to a stop in front of it ----------
const FINALE = { key: 'finale', verse: '“May glory be given to God in the highest heaven! And may peace be given to those he is pleased with on earth!”', ref: 'Luke 2:14' };
const finale = { g: new THREE.Group(), active: false, z: 0, stopped: false, t: 0, STOP_Z: -17 };
{ const g = finale.g; g.visible = false; scene.add(g);
  finale.spr = billboard('finale', 10, g, 0, 0);
  const warm = glowSprite(0xffb040, 9); warm.position.set(0, 3.2, 0.5); g.add(warm); finale.warm = warm;
  const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); st.scale.set(14, 14, 1); st.position.set(0, 12.8, 0); g.add(st); finale.star = st; }
function spawnFinale() { S.lane = 1; finale.active = true; finale.stopped = false; finale.t = 0; finale.z = -150; finale.g.position.set(0, 0, finale.z); finale.g.visible = true;
  for (const o of obstacles) { o.g.visible = false; o.z = 99; } }
function hideFinale() { finale.active = false; finale.g.visible = false; }
function updateFinale(dz, dt, t) {
  if (!finale.active) return;
  finale.z += dz; finale.g.position.z = finale.z;
  for (const seg of segments) { const sz = seg.g.position.z; if (sz < finale.z + 14) { seg.arch.visible = seg.gate.visible = seg.banner.visible = false; seg.L.forEach(o => o.visible = false); seg.R.forEach(o => o.visible = false); } }
  const tw = 14 * (1 + Math.sin(t * 4) * 0.06); finale.star.scale.set(tw, tw, 1); finale.warm.material.opacity = 0.55 + Math.sin(t * 2.5) * 0.12;
  if (!finale.stopped && finale.z >= finale.STOP_Z - 0.05) { finale.stopped = true; finale.z = finale.STOP_Z; Sfx.narrate(FINALE); emit(0, 4, finale.z + 2, 90, 0xffe066, 9, 0.6, 1.4, 3); }
  if (finale.stopped && S.state === 'play') { finale.t += dt; if (finale.t > 6.5) storyEnd(); }
}
// ---------- Weather phases (distance-driven snow cycle) ----------
// per 1500-mile story cycle: snow between Gabriel (300) and the inn (600), again between the shepherds (900) and the stable;
// clear starry sky for the shepherds, the stable (1200) and the Wise Men following the star (1500)
function snowTarget(d) { if (S.story) return (d > 250 && d < 380) || (d > 700 && d < 820) ? 1 : 0; const c = d % STORY_CYCLE; return ((c > 340 && c < 560) || (c > 940 && c < 1080)) ? 1 : 0; }
const W = { snow: 0 };
// ---------- Player (painted billboard sprite) ----------
const player = new THREE.Group(); scene.add(player);
const P = {};
(function buildPlayer() {
  P.body = new THREE.Group(); player.add(P.body);
  P.sprite = new THREE.Mesh(planeG, spriteMat(SPR.run0)); P.sprite.castShadow = true; P.body.add(P.sprite);
  P.setFrame = (n, h) => { const t = SPR[n]; if (P.sprite.material.map !== t) { P.sprite.material.map = t; P.sprite.material.needsUpdate = true; } const i = t.image; P.sprite.scale.set(h * (i && i.width ? i.width / i.height : 0.6), h, 1); };
  P.shield = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16), noOutline(new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
  P.shield.position.y = 1.15; P.shield.visible = false; player.add(P.shield);
  P.magRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 6, 40), noOutline(new THREE.MeshBasicMaterial({ color: 0xe05cff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })));
  P.magRing.rotation.x = Math.PI / 2; P.magRing.position.y = 0.1; P.magRing.visible = false; player.add(P.magRing);
  P.blob = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), noOutline(new THREE.MeshBasicMaterial({ color: 0x3a1d08, transparent: true, opacity: 0.28, depthWrite: false })));
  P.blob.rotation.x = -Math.PI / 2; P.blob.position.y = 0.03; scene.add(P.blob);
})();

// ---------- Obstacles ----------
function spriteOb(name, h, box, extra = {}) {
  const g = new THREE.Group(); const b = billboard(name, h, g);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), P.blob.material); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.scale.set(box.hw * 1.1, box.hd * 0.9 + 0.3, 1); g.add(sh);
  g.userData.spr = b; return { g, box, ...extra };
}
const mkCart = () => spriteOb('cart', 1.9, { hw: 0.95, hd: 1.0, y0: 0, y1: 1.3 });
const mkBaskets = () => spriteOb('baskets', 1.75, { hw: 0.85, hd: 0.5, y0: 0, y1: 1.2 });
const mkCamel = () => spriteOb('camel', 3.4, { hw: 0.85, hd: 1.2, y0: 0, y1: 3.2 });
const mkDonkeyCart = () => spriteOb('donkey', 2.5, { hw: 0.95, hd: 2.0, y0: 0, y1: 1.4 }, { moving: true });
function mkBarrier() {
  const g = new THREE.Group();
  boxM(7, 0.85, 0.8, M.sandD, 0, 0.43, 0, g, true, 0.2);
  for (let x = -3; x <= 3; x += 1.5) boxM(0.8, 0.3, 0.9, M.sand, x, 0.98, 0, g, true, 0.12);
  for (const x of [-2.2, 0, 2.2]) billboard('pots', 0.9, g, x + 0.7, 0.45);
  return { g, box: { hw: 3.5, hd: 0.45, y0: 0, y1: 1.1 }, wide: true };
}
function mkAwning() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) boxM(0.28, 2.8, 0.28, M.darkWood, s * 3.55, 1.4, 0, g, true, 0.1);
  boxM(7.4, 0.26, 0.3, M.wood, 0, 2.7, 0, g, true, 0.1); boxM(7.4, 0.2, 0.26, M.wood, 0, 1.28, 0, g, true, 0.08);
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3, 14, 2), pick(M.cloths)); cl.position.set(0, 1.95, 0.05); cl.castShadow = true; g.add(cl);
  const p = cl.geometry.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < 0) p.setY(i, p.getY(i) - Math.abs(Math.sin(p.getX(i) * 2.2)) * 0.18); } p.needsUpdate = true;
  noOutline(cl.material);
  return { g, box: { hw: 3.5, hd: 0.2, y0: 1.1, y1: 3 }, wide: true };
}
const OB_TYPES = { cart: mkCart, baskets: mkBaskets, barrier: mkBarrier, awning: mkAwning, camel: mkCamel, donkey: mkDonkeyCart };
const obPool = {}, obstacles = [];
for (const k in OB_TYPES) { obPool[k] = []; for (let i = 0; i < 6; i++) { const o = OB_TYPES[k](); o.type = k; o.g.visible = false; scene.add(o.g); obPool[k].push(o); } }
function spawnOb(type, lane, z) {
  const o = obPool[type].pop() || Object.assign(OB_TYPES[type](), { type });
  if (!o.g.parent) scene.add(o.g);
  o.lane = lane; o.x = o.wide ? 0 : LANES[lane]; o.z = z; o.hitFx = 0; o.g.visible = true; o.g.position.set(o.x, 0, z); obstacles.push(o); return o;
}

// ---------- Collectibles (painted icons) ----------
const PCOL = { sandals: 0xffb030, shield: 0x7fd0ff, magnet: 0xe05cff };
var _glow;
function glowTex() { if (_glow) return _glow; const c = makeCanvas(64, (g, s) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }); _glow = new THREE.CanvasTexture(c); return _glow; }
const ISZ = { coin: 0.85, scroll: 0.95, lamp: 0.95, sandals: 1.1, shield: 1.1, magnet: 1.1 };
function mkItem(kind) {
  const g = new THREE.Group();
  if (kind !== 'coin') { const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PCOL[kind] || 0xffe066, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })); glow.scale.setScalar(kind in PCOL ? 2.4 : 1.8); g.add(glow); }
  const b = billboard(kind, ISZ[kind], g, 0, 0, true); b.castShadow = false;
  g.userData.spr = b; return { g, kind };
}
const items = [];
const itemPool = { coin: [], scroll: [], lamp: [], sandals: [], shield: [], magnet: [] };
const ITEM_MK = k => mkItem(k);
for (let i = 0; i < 70; i++) { const c = mkItem('coin'); c.g.visible = false; scene.add(c.g); itemPool.coin.push(c); }
function spawnItem(kind, x, y, z) {
  const it = itemPool[kind].pop() || ITEM_MK(kind); it.kind = kind;
  if (!it.g.parent) scene.add(it.g);
  it.x = x; it.y = y; it.z = z; it.g.visible = true; it.g.position.set(x, y, z); it.phase = Math.random() * 6; it.mag = false; items.push(it); return it;
}
// ---------- Particles ----------
const PMAX = 600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
const pVel = new Float32Array(PMAX * 3), pLife = new Float32Array(PMAX), pMaxLife = new Float32Array(PMAX), pBase = new Float32Array(PMAX);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
  uniforms: { map: { value: glowTex() }, scale: { value: innerHeight / 2 } },
  vertexShader: `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * 300. / -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC*t.a, t.a); }`
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
let pIdx = 0;
function emit(x, y, z, n, color, speed = 4, size = 0.35, life = 0.7, up = 2) {
  const c = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const i = pIdx = (pIdx + 1) % PMAX;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    const th = Math.random() * 6.28, ph = Math.random() * 3.14, s = speed * rand(0.4, 1);
    pVel[i * 3] = Math.cos(th) * Math.sin(ph) * s; pVel[i * 3 + 1] = Math.cos(ph) * s + up; pVel[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * s;
    pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    pLife[i] = pMaxLife[i] = life * rand(0.6, 1.2); pBase[i] = size * rand(0.6, 1.3);
  }
}
function updateParticles(dt, worldDz) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) { pSize[i] = 0; continue; }
    pLife[i] -= dt;
    pVel[i * 3 + 1] -= 6 * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt + worldDz;
    pSize[i] = pBase[i] * Math.max(0, pLife[i] / pMaxLife[i]);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
}
// floating dust motes in sunbeams
const DM = 420; const dGeo = new THREE.BufferGeometry(); const dPos = new Float32Array(DM * 3);
for (let i = 0; i < DM; i++) { dPos[i * 3] = rand(-9, 9); dPos[i * 3 + 1] = rand(0.5, 7); dPos[i * 3 + 2] = rand(-80, 10); }
dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ map: glowTex(), color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
dust.frustumCulled = false; scene.add(dust);

// ---------- Audio (synthesized) ----------
const Sfx = {
  ctx: null, master: null, muted: localStorage.getItem('bh_muted') === '1', musicT: null,
  // independent channels: music bus + sfx bus (+ coin toggle), all remembered in bh_ storage
  cfg: { musicOn: localStorage.getItem('bh_musicOn') !== '0', musicVol: +(localStorage.getItem('bh_musicVol') ?? 0.7), sfxOn: localStorage.getItem('bh_sfxOn') !== '0', sfxVol: +(localStorage.getItem('bh_sfxVol') ?? 0.8), coinsOn: localStorage.getItem('bh_coinsOn') !== '0', narrOn: localStorage.getItem('bh_narrOn') !== '0', narrVol: +(localStorage.getItem('bh_narrVol') ?? 1) },
  saveCfg() { const c = this.cfg; localStorage.setItem('bh_musicOn', c.musicOn ? '1' : '0'); localStorage.setItem('bh_musicVol', c.musicVol); localStorage.setItem('bh_sfxOn', c.sfxOn ? '1' : '0'); localStorage.setItem('bh_sfxVol', c.sfxVol); localStorage.setItem('bh_coinsOn', c.coinsOn ? '1' : '0'); localStorage.setItem('bh_narrOn', c.narrOn ? '1' : '0'); localStorage.setItem('bh_narrVol', c.narrVol); this.applyCfg(); if (!c.narrOn || this.muted) this.stopNarr(); },
  applyCfg() { if (!this.ctx) return; const c = this.cfg, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, t, 0.02);
    this.music.gain.setTargetAtTime(c.musicOn ? 0.32 * c.musicVol * (this.ducked ? 0.3 : 1) : 0, t, this.ducked ? 0.12 : 0.4);
    this.narr.gain.setTargetAtTime(c.narrOn ? 1.6 * c.narrVol : 0, t, 0.05);
    this.sfx.gain.setTargetAtTime(c.sfxOn ? c.sfxVol : 0, t, 0.02); },
  live: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    this.hp = this.ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 120; this.hp.Q.value = 0.7;
    this.master.connect(this.hp); this.hp.connect(this.ctx.destination);
    this.music = this.ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
    this.narr = this.ctx.createGain(); this.narr.gain.value = 1; this.narr.connect(this.master); this.applyCfg(); this.loadNarr();
    // iOS: play a silent buffer inside the first tap so the context is unlocked
    try { const sb = this.ctx.createBufferSource(); sb.buffer = this.ctx.createBuffer(1, 1, 22050); sb.connect(this.ctx.destination); sb.start(0); } catch (e) {} if (this.ctx.state === 'suspended') this.ctx.resume();
    const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, len); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  _track(node, ...chain) { this.live++; node.onended = () => { this.live--; node.disconnect(); chain.forEach(n => n.disconnect()); }; },
  tone(f, dur, type = 'sine', vol = 0.2, f2, delay = 0, dest) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.04); this._track(o, g);
  },
  pluck(f, t, vol = 0.12, dur = 0.5) { // lyre/oud-like: bright attack, filtered decay, short
    const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f * 1.003;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur * 0.6); lp.Q.value = 2;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.music);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); this._track(o1, lp, g); this._track(o2, g2);
  },
  drum(t, f, q, vol, dur) { // soft hand percussion (filtered noise tap)
    const c = this.ctx, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.music); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); this._track(s, bp, g);
  },
  noiseHit(dur, f, vol = 0.3, type = 'lowpass', f2) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(t); s.stop(t + dur + 0.02); this._track(s, fl, g);
  },
  coin() { if (!this.cfg.coinsOn) return; this.tone(1318, 0.09, 'sine', 0.03); this.tone(1976, 0.14, 'sine', 0.022, null, 0.05); }, // much softer by default
  jump() { this.noiseHit(0.25, 600, 0.15, 'bandpass', 2500); this.tone(220, 0.2, 'triangle', 0.08, 440); },
  slide() { this.noiseHit(0.35, 2000, 0.15, 'bandpass', 400); },
  lane() { this.noiseHit(0.12, 1500, 0.07, 'bandpass', 3000); },
  item() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, null, i * 0.06)); },
  power() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.05, null, i * 0.07)); this.tone(1046, 0.8, 'sine', 0.1, null, 0.35); },
  crash() { this.noiseHit(0.6, 900, 0.5, 'lowpass', 80); this.tone(220, 0.4, 'triangle', 0.1, 130); },
  shieldBreak() { this.noiseHit(0.4, 4000, 0.25, 'highpass', 800); this.tone(880, 0.4, 'sine', 0.12, 220); },
  setMuted(m) { this.muted = m; localStorage.setItem('bh_muted', m ? '1' : '0'); this.applyCfg(); if (m) this.stopNarr(); },
  // ---- narration: pre-rendered neural TTS clips on their own bus, ducks the music while speaking ----
  narrBuf: {}, narrSrc: null, ducked: false, narrLog: [],
  loadNarr() { for (const sc of [...STORY, FINALE]) { const k = sc.key, url = (window.__NARR && window.__NARR[k]) || ('narr/' + k + '.mp3');
    fetch(url).then(r => r.arrayBuffer()).then(ab => new Promise((ok, bad) => this.ctx.decodeAudioData(ab, ok, bad))).then(b => { this.narrBuf[k] = b; }).catch(() => {}); } },
  stopNarr() { if (this.narrSrc) { try { this.narrSrc.onended = null; this.narrSrc.stop(); } catch (e) {} this.narrSrc = null; } if (window.speechSynthesis) speechSynthesis.cancel(); this.duck(false); },
  duck(on) { this.ducked = on; this.applyCfg(); },
  narrate(sc) { if (!this.ctx || this.muted || !this.cfg.narrOn) return; this.stopNarr(); if (this.ctx.state === 'suspended') this.ctx.resume();
    const b = this.narrBuf[sc.key];
    if (b) { const src = this.ctx.createBufferSource(); src.buffer = b; src.connect(this.narr); src.onended = () => { if (this.narrSrc === src) { this.narrSrc = null; this.duck(false); } }; src.start(this.ctx.currentTime + 0.05); this.narrSrc = src; this.duck(true); this.narrLog.push({ key: sc.key, via: 'buffer', dur: b.duration }); return; }
    if (window.speechSynthesis && window.SpeechSynthesisUtterance) { // fallback only if a clip failed to load
      const u = new SpeechSynthesisUtterance(sc.verse.replace(/[“”…]/g, ' ') + ' ' + sc.ref); u.rate = 0.88; u.volume = Math.min(1, this.cfg.narrVol); u.onend = () => this.duck(false); this.duck(true); speechSynthesis.speak(u); this.narrLog.push({ key: sc.key, via: 'speech' }); } },
  startMusic() {
    if (!this.ctx || this.musicT) return;
    // Public-domain carols, arranged here as gentle plucked-lyre melodies (all notes >= C4, bass >= C3)
    // format: 'NOTE:len' in 16ths, '-' = rest; bass: one root per bar
    const SONGS = [
      { name: 'Joy to the World', bpm: 92, bar: 16, mel: 'C5:4 B4:3 A4:1 G4:6 F4:2 E4:4 D4:4 C4:6 G4:2 A4:6 A4:2 B4:6 B4:2 C5:12 -:4 C5:2 C5:2 B4:2 A4:2 G4:3 F4:1 E4:2 C5:2 C5:2 B4:2 A4:2 G4:3 F4:1 E4:2 E4:2 E4:2 E4:2 E4:2 E4:2 F4:1 G4:7 F4:1 E4:1 D4:2 D4:2 D4:2 D4:1 E4:1 F4:6 E4:1 D4:1 C4:2 C5:4 A4:2 G4:3 F4:1 E4:2 F4:2 E4:4 D4:4 C4:12 -:4',
        bass: 'C3 C3 F3 G3 C3 C3 C3 C3 C3 G3 G3 F3 G3 C3 C3' },
      { name: 'Silent Night', bpm: 66, bar: 12, mel: 'G4:3 A4:1 G4:2 E4:6 G4:3 A4:1 G4:2 E4:6 D5:4 D5:2 B4:6 C5:4 C5:2 G4:6 A4:4 A4:2 C5:3 B4:1 A4:2 G4:3 A4:1 G4:2 E4:6 A4:4 A4:2 C5:3 B4:1 A4:2 G4:3 A4:1 G4:2 E4:6 D5:4 D5:2 F5:3 D5:1 B4:2 C5:6 E5:6 C5:3 G4:1 E4:2 G4:3 F4:1 D4:2 C4:12 -:12',
        bass: 'C3 C3 C3 C3 G3 G3 C3 C3 F3 F3 C3 C3 F3 F3 C3 C3 G3 G3 C3 C3 C3 G3 C3 C3' },
      { name: 'O Come, All Ye Faithful', bpm: 88, bar: 16, mel: '-:12 G4:4 G4:8 D4:4 G4:4 A4:8 D4:8 B4:4 A4:4 B4:4 C5:4 B4:8 A4:4 G4:4 G4:8 F#4:4 E4:4 F#4:4 G4:4 A4:4 B4:4 F#4:8 E4:6 D4:2 D4:16 D5:8 C5:4 B4:4 C5:8 B4:8 A4:4 B4:4 G4:4 A4:4 F#4:6 E4:2 D4:4 G4:4 G4:4 F#4:4 G4:4 A4:4 G4:8 D4:4 B4:4 B4:4 A4:4 B4:4 C5:4 B4:8 A4:4 B4:4 C5:4 B4:4 A4:4 G4:4 F#4:8 G4:4 C5:4 B4:8 A4:6 G4:2 G4:16',
        bass: 'G3 G3 D3 G3 G3 C3 G3 D3 D3 G3 C3 G3 D3 D3 G3 G3 G3 G3 C3 D3 G3' },
    ];
    const A4 = 440, SEMI = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
    const fq = n => { const m = n.match(/^([A-G]#?)(\d)$/); return A4 * Math.pow(2, (SEMI[m[1]] + (+m[2] - 4) * 12) / 12); };
    const ev = []; let T = 0; // build one long loop: [time16, freq, len16, kind]
    for (const sg of SONGS) {
      const k = 126 / sg.bpm; // scale so each song keeps its own tempo on the shared 16th grid
      let t = 0; for (const tok of sg.mel.split(' ')) { const [n, l] = tok.split(':'); if (n !== '-') ev.push([T + t * k, fq(n), +l * k, 'm']); t += +l; }
      const bars = sg.bass.split(' '); for (let b = 0; b * sg.bar < t; b++) { const r = bars[b % bars.length]; ev.push([T + b * sg.bar * k, fq(r), sg.bar * k, 'b']); ev.push([T + (b * sg.bar + sg.bar / 2) * k, fq(r) * 1.5, sg.bar * k / 2, 'b']); }
      T += (t + 8) * k; // short breath between carols
    }
    ev.sort((a, b) => a[0] - b[0]);
    const s16 = 60 / 126 / 4; let i = 0, loop = 0, t0 = this.ctx.currentTime + 0.15;
    const tick = () => {
      const now = this.ctx.currentTime;
      while (true) {
        if (i >= ev.length) { i = 0; loop++; t0 += T * s16; }
        const e = ev[i], at = t0 + e[0] * s16; if (at > now + 0.35) break;
        if (at > now - 0.05) { if (e[3] === 'm') { this.pluck(e[1], at, 0.1, Math.min(1.4, 0.35 + e[2] * s16 * 0.9)); this.pluck(e[1] * 2, at, 0.018, 0.5); } else this.pluck(e[1], at, 0.05, Math.min(1.6, e[2] * s16)); }
        i++;
      }
    };
    tick(); this.musicT = setInterval(tick, 100);
  },
  stopMusic() { if (this.musicT) { clearInterval(this.musicT); this.musicT = null; } },
};

// ---------- Game state ----------
const S = {
  state: 'loading', lane: 1, x: 0, y: 0, vy: 0, sliding: 0, speed: 0, dist: 0, score: 0, coins: 0, mult: 1, runT: 0,
  power: { sandals: 0, shield: 0, magnet: 0 }, nextRow: 0, dead: 0, shake: 0, best: +localStorage.getItem('bh_best') || 0, invuln: 0,
};
const BASE_SPEED = 15, MAX_SPEED = 36, GRAV = 40, JUMP_V = 13.2;
const DUR = { sandals: 6, shield: 14, magnet: 10 };
const VERSES = [
  ['The LORD says, “Bethlehem Ephrathah, you might not be an important town in the nation of Judah. But out of you will come for me a ruler over Israel.”', 'Micah 5:2'],
  ['She gave birth to her first baby. It was a boy. She wrapped him in large strips of cloth. Then she placed him in a manger. That’s because there was no guest room where they could stay.', 'Luke 2:7'],
  ['“Do not be afraid. I bring you good news. It will bring great joy for all the people. Today in the town of David a Savior has been born to you. He is the Messiah, the Lord.”', 'Luke 2:10-11'],
  ['“May glory be given to God in the highest heaven! And may peace be given to those he is pleased with on earth!”', 'Luke 2:14'],
  ['Then the shepherds said to one another, “Let’s go to Bethlehem. Let’s see this thing that has happened, which the Lord has told us about.”', 'Luke 2:15'],
  ['“Where is the child who has been born to be king of the Jews? We saw his star when it rose. Now we have come to worship him.”', 'Matthew 2:2'],
  ['When they saw the star, they were filled with joy.', 'Matthew 2:10'],
  ['The people who are now living in darkness will see a great light. They are now living in a very dark land. But a light will shine on them.', 'Isaiah 9:2'],
  ['A child will be born to us. A son will be given to us. He will rule over us. And he will be called Wonderful Adviser and Mighty God. He will also be called Father Who Lives Forever and Prince Who Brings Peace.', 'Isaiah 9:6'],
  ['The virgin is going to have a baby. She will give birth to a son. And he will be called Immanuel.', 'Isaiah 7:14'],
  ['But those who trust in the LORD will receive new strength. They will fly as high as eagles. They will run and not get tired. They will walk and not grow weak.', 'Isaiah 40:31'],
  ['Also, pick up the shield of faith. With it you can put out all the flaming arrows of the evil one.', 'Ephesians 6:16'],
];

function fitOver(){const ov=$('over'),q=$('verse');if(!ov||!q)return;q.style.fontSize='';let f=parseFloat(getComputedStyle(q).fontSize);while(ov.scrollHeight>ov.clientHeight+1&&f>11){f-=.5;q.style.fontSize=f+'px'}}
addEventListener('resize',()=>{if($('over')&&!$('over').classList.contains('hidden'))fitOver()});
function clearWorld() {
  for (const o of obstacles) { o.g.visible = false; obPool[o.type].push(o); } obstacles.length = 0;
  for (const it of items) { it.g.visible = false; itemPool[it.kind].push(it); } items.length = 0;
}
function resetRun() {
  clearWorld();
  Object.assign(S, { slowK: 0, endT: 0, lane: 1, x: 0, y: 0, vy: 0, sliding: 0, speed: BASE_SPEED, dist: 0, score: 0, coins: 0, mult: 1, runT: 0, dead: 0, shake: 0, invuln: 0, nextRow: -45 });
  if (Q.has('start')) S.dist = +Q.get('start') || 0;
  hideStable(); hideFinale(); stable.idx = storyIndexFrom(S.dist); W.snow = snowTarget(S.dist); bannerT = 0; $('banner').classList.remove('show');
  S.power = { sandals: 0, shield: 0, magnet: 0 };
  player.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0);
  // pre-populate
  let z = -45; while (z > -170) { spawnRow(z); z -= rowGap(); } S.nextRow = z;
}
const rowGap = () => 15 + S.speed * 0.42;

function coinLine(lane, z0, n, arcOver) {
  for (let i = 0; i < n; i++) {
    const z = z0 + i * 2.2; let y = 1;
    if (arcOver != null) { const t = (z - (arcOver - 6)) / 12; if (t > 0 && t < 1) y = 1 + Math.sin(t * Math.PI) * 2; }
    spawnItem('coin', LANES[lane], y, z);
  }
}
function spawnRow(z) {
  const d = S.dist;
  const r = Math.random();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  if (!S.story && (stable.active || S.dist >= storyAt(stable.idx).d - STORY_LEAD - 70)) { // slow scenic zone: coins only, no obstacles
    if (Math.random() < 0.6) coinLine(1, z - 6, 5); return; }
  if (S.story) { // center lane always open: coins down the middle, a few harmless roadside props in the side lanes
    if (Math.random() < 0.7) coinLine(1, z - 6, 5);
    if (Math.random() < 0.35) spawnOb(pick(['baskets', 'cart']), Math.random() < 0.5 ? 0 : 2, z);
    if (Math.random() < 0.08) spawnItem('lamp', LANES[1], 1.0, z + 7);
    return;
  }
  const hard = Math.min(1, d / 2500);
  if (r < 0.12 && d > 150) { // full-width awning -> slide
    spawnOb('awning', 1, z); coinLine(lanes[0], z - 3, 4); for (const it of items.slice(-4)) { it.y = 0.6; it.g.position.y = 0.6; }
  } else if (r < 0.22 && d > 80) { // stone barrier -> jump
    spawnOb('barrier', 1, z); coinLine(lanes[0], z - 6, 6, z);
  } else if (r < 0.34 && d > 250) { // moving donkey cart
    spawnOb('donkey', lanes[0], z - 40); coinLine(lanes[1], z - 6, 6);
  } else {
    const nObs = Math.random() < 0.35 + hard * 0.4 ? 2 : 1;
    const types = ['cart', 'baskets', 'camel', 'cart', 'baskets'];
    for (let k = 0; k < nObs; k++) {
      const t = pick(types); spawnOb(t, lanes[k], z + (t === 'camel' ? -0.5 : 0));
      if (k === 0 && t !== 'camel' && Math.random() < 0.5) coinLine(lanes[k], z - 6, 6, z);
    }
    if (Math.random() < 0.8) coinLine(lanes[2], z - 6, 7);
  }
  // bonus items
  const rr = Math.random();
  const free = LANES[lanes[2]];
  if (rr < 0.07) spawnItem(pick(['sandals', 'shield', 'magnet']), free, 1.2, z + 7);
  else if (rr < 0.16) spawnItem('scroll', free, 1.1, z + 7);
  else if (rr < 0.27) spawnItem('lamp', free, 1.0, z + 7);
}

// ---------- Input ----------
function act(a) {
  if (S.state !== 'play' || S.dead) return;
  if (a === 'left' && S.lane > 0) { S.lane--; Sfx.lane(); P.lean = 1; }
  if (a === 'right' && S.lane < 2) { S.lane++; Sfx.lane(); P.lean = -1; }
  if (a === 'up' && S.y <= 0.001) { S.vy = JUMP_V; S.sliding = 0; Sfx.jump(); emit(S.x, 0.1, 0, 12, 0xd9b783, 3, 0.4, 0.5, 1); }
  if (a === 'down') { if (S.y > 0.01) S.vy = -24; S.sliding = 0.75; Sfx.slide(); }
}
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'a', 'A'].includes(k)) act('left');
  else if (['ArrowRight', 'd', 'D'].includes(k)) act('right');
  else if (['ArrowUp', 'w', 'W', ' '].includes(k)) { act('up'); if (S.state === 'menu' || S.state === 'over') { if (k === ' ') startGame(false); } }
  else if (['ArrowDown', 's', 'S'].includes(k)) act('down');
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
  else if (k === 'm' || k === 'M') toggleMute();
  else if (k === 'Enter' && (S.state === 'menu' || S.state === 'over')) startGame(false);
  if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
});
let tStart = null;
addEventListener('touchstart', e => { const t = e.touches[0]; tStart = { x: t.clientX, y: t.clientY, used: false }; }, { passive: true });
addEventListener('touchmove', e => {
  if (!tStart || tStart.used) return; const t = e.touches[0]; const dx = t.clientX - tStart.x, dy = t.clientY - tStart.y;
  if (Math.hypot(dx, dy) > 30) { tStart.used = true; if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? 'right' : 'left'); else act(dy > 0 ? 'down' : 'up'); }
}, { passive: true });
addEventListener('touchend', () => { tStart = null; });

// ---------- UI ----------
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function startGame(story) {
  S.story = story === true; document.body.classList.toggle('storymode', S.story); show('endP', false);
  Sfx.init(); Sfx.stopNarr(); Sfx.startMusic();
  resetRun(); S.state = 'play';
  show('menu', false); show('over', false); show('paused', false); show('hud', true);
}
function storyEnd() { S.state = 'end'; S.slowK = 0; $('banner').classList.remove('show'); bannerT = 0; show('endP', true); }
function gameOver() {
  S.state = 'over'; Sfx.stopMusic(); Sfx.stopNarr();
  const sc = Math.floor(S.score), nb = sc > S.best; if (nb) { S.best = sc; localStorage.setItem('bh_best', sc); }
  $('fScore').textContent = sc.toLocaleString(); $('fCoins').textContent = S.coins; $('fDist').textContent = Math.floor(S.dist) + " miles";
  $('bestOver').textContent = S.best.toLocaleString(); $('bestMenu').textContent = S.best.toLocaleString(); show('newBest', nb);
  const showV = localStorage.getItem('bh_verse') !== '0'; $('verseToggle').checked = showV;
  const v = pick(VERSES); $('verse').innerHTML = `&ldquo;${v[0]}&rdquo;<cite>${v[1]} (NIrV)</cite><small class="nirv-note">Scripture quotations taken from The Holy Bible, New International Reader&#39;s Version®, NIrV® Copyright © 1995, 1996, 1998, 2014 by Biblica, Inc.® Used by permission. All rights reserved worldwide.</small>`; show('verse', showV);
  show('over', true); requestAnimationFrame(fitOver);
}
function togglePause() {
  if (S.state === 'play') { S.state = 'paused'; show('paused', true); if (Sfx.ctx) Sfx.ctx.suspend(); }
  else if (S.state === 'paused') { S.state = 'play'; show('paused', false); if (Sfx.ctx) Sfx.ctx.resume(); }
}
function toggleMute() { Sfx.init(); Sfx.setMuted(!Sfx.muted); syncSound(); } // M / ♫ button = mute ALL
// ---------- Sound settings (title + pause), independent music / effects / coin sounds ----------
function soundHTML() { return `<div class="sndrow"><label><input type="checkbox" data-k="musicOn"> Music</label><input type="range" min="0" max="1" step="0.05" data-k="musicVol" aria-label="Music volume"></div>
<div class="sndrow"><label><input type="checkbox" data-k="sfxOn"> Sound effects</label><input type="range" min="0" max="1" step="0.05" data-k="sfxVol" aria-label="Effects volume"></div>
<div class="sndrow"><label><input type="checkbox" data-k="narrOn"> Narration</label><input type="range" min="0" max="1" step="0.05" data-k="narrVol" aria-label="Narration volume"></div>
<div class="sndrow"><label><input type="checkbox" data-k="coinsOn"> Coin sounds</label><label class="allm"><input type="checkbox" data-k="muted"> Mute all</label></div>`; }
for (const el of document.querySelectorAll('.sndbox')) el.innerHTML = soundHTML();
function syncSound() {
  for (const inp of document.querySelectorAll('.sndbox input')) { const k = inp.dataset.k; if (k === 'muted') inp.checked = Sfx.muted; else if (inp.type === 'checkbox') inp.checked = Sfx.cfg[k]; else inp.value = Sfx.cfg[k]; }
  $('muteBtn').style.opacity = Sfx.muted ? 0.4 : 1;
}
document.addEventListener('input', e => { const inp = e.target; if (!inp.closest || !inp.closest('.sndbox')) return; const k = inp.dataset.k;
  Sfx.init(); if (k === 'muted') Sfx.setMuted(inp.checked); else { Sfx.cfg[k] = inp.type === 'checkbox' ? inp.checked : +inp.value; Sfx.saveCfg(); }
  if ((k === 'coinsOn' && inp.checked) || k === 'sfxVol') Sfx.coin(); if (inp.type === 'checkbox') inp.blur(); syncSound(); });
for (const ev of ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'mousedown']) document.addEventListener(ev, e => { if (e.target.closest && e.target.closest('.snd, .sndbox')) e.stopPropagation(); }, { capture: true, passive: true });
syncSound();
$('playBtn').onclick = () => startGame(false); $('againBtn').onclick = () => startGame(S.story);
$('storyBtn').onclick = () => startGame(true); $('endAgain').onclick = () => startGame(true);
$('endMenu').onclick = () => { show('endP', false); show('hud', false); show('menu', true); S.state = 'menu'; S.story = false; document.body.classList.remove('storymode'); clearWorld(); hideStable(); hideFinale(); Sfx.stopNarr(); };
$('menuBtn').onclick = () => { show('over', false); show('hud', false); show('menu', true); S.state = 'menu'; clearWorld(); };
$('resumeBtn').onclick = togglePause; $('pauseBtn').onclick = togglePause; $('muteBtn').onclick = toggleMute;
$('verseToggle').onchange = e => { localStorage.setItem('bh_verse', e.target.checked ? '1' : '0'); show('verse', e.target.checked); };
$('bestMenu').textContent = S.best.toLocaleString();
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); toastT = 1.4; }
const NAMES = { sandals: 'Swift Hooves', shield: 'Shield of Faith', magnet: 'Coin Magnet' };
let lastPowHTML = '';
function updateHUD() {
  $('score').textContent = Math.floor(S.score).toLocaleString();
  $('dist').textContent = Math.floor(S.dist) + " miles";
  $('coins').textContent = S.coins; $('mult').textContent = S.mult;
  let h = '';
  for (const k in S.power) if (S.power[k] > 0) h += `<div class="pbar" style="border-color:#${PCOL[k].toString(16)}">${NAMES[k]}<div class="fill" style="width:${(S.power[k] / DUR[k] * 100).toFixed(0)}%;background:#${PCOL[k].toString(16)}"></div></div>`;
  if (h !== lastPowHTML) { $('powers').innerHTML = h; lastPowHTML = h; }
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let lowN = 0, fpsAcc = 0, fpsN = 0, qualityLevel = 0, animT = 0;
const camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(0, 1.2, -8), curLook = new THREE.Vector3(0, 1.2, -8);

function playerBox() { const h = S.sliding > 0 ? 0.85 : 1.9; return { x0: S.x - 0.38, x1: S.x + 0.38, y0: S.y, y1: S.y + h, z0: -0.35, z1: 0.35 }; }

function update(dt) {
  const playing = S.state === 'play';
  let speed = 0;
  if (playing && !S.dead) {
    S.runT += dt;
    S.speed = S.story ? STORY_SPEED : Math.min(MAX_SPEED, BASE_SPEED + S.dist * 0.0075);
    speed = S.speed * (S.power.sandals > 0 && !S.story ? 1.45 : 1);
    // ease into a slow cruise as a story scene nears, hold while passing, ease back out
    { const inZone = stable.active && stable.z > -95 && stable.z < 22; S.slowK += ((inZone ? 1 : 0) - S.slowK) * (1 - Math.exp(-(inZone ? 1.3 : 0.8) * dt));
      const cruise = S.story ? 5.5 : 9; speed = speed + (Math.min(speed, cruise) - speed) * S.slowK; }
    if (finale.active) { const rem = finale.STOP_Z - finale.z; speed = finale.stopped ? 0 : Math.max(0.6, Math.min(speed, rem * 0.32)); if (rem < 0.6 && !finale.stopped) speed = rem / Math.max(dt, 1e-3); }
    S.dist += speed * dt;
    S.mult = S.story ? 1 : 1 + Math.floor(S.dist / 500) + (S.power.sandals > 0 ? 1 : 0);
    S.score += speed * dt * 0.5 * S.mult;
    for (const k in S.power) S.power[k] = Math.max(0, S.power[k] - dt);
    if (S.invuln > 0) S.invuln -= dt;
  } else if (S.state === 'menu' || S.state === 'loading') speed = 7; // gentle attract-mode scroll
  const dz = speed * dt;
  animT += dt * (speed > 0 ? speed * 0.55 : 2);

  // world scroll
  TX.cobble.offset.y = (TX.cobble.offset.y + dz / (300 / 80)) % 1;
  for (const seg of segments) { seg.g.position.z += dz; if (seg.g.position.z > 10 + SEG_LEN) { seg.g.position.z -= SEG_N * SEG_LEN; randomizeSeg(seg, false); } }
  for (let i = 0; i < DM; i++) { dPos[i * 3 + 2] += dz * 0.9; dPos[i * 3 + 1] -= dt * (0.9 + (i % 7) * 0.12) * (0.4 + 0.6 * W.snow); dPos[i * 3] += Math.sin(animT * 0.03 + i) * 0.004; if (dPos[i * 3 + 1] < 0) dPos[i * 3 + 1] += 8; if (dPos[i * 3 + 2] > 10) dPos[i * 3 + 2] -= 90; }
  star.material.rotation = Math.sin(performance.now() * 0.0004) * 0.03; { const tw = 1 + Math.sin(performance.now() * 0.003) * 0.04; star.scale.set(175 * tw, 175 * tw, 1); }
  dGeo.attributes.position.needsUpdate = true;
  { const tgt = (S.state === 'play' || S.state === 'over' || S.state === 'paused' || S.state === 'end') ? snowTarget(S.dist) : 1; W.snow += (tgt - W.snow) * (1 - Math.exp(-0.8 * dt));
    dust.material.opacity = 0.9 * W.snow; dust.visible = W.snow > 0.01; skyStars.material.opacity = 0.55 + 0.4 * (1 - W.snow); }
  if (S.state === 'play' && !S.dead && !stable.active && S.dist >= storyAt(stable.idx).d - STORY_LEAD) { spawnStable(); stable.idx++; }
  if (S.story && S.state === 'play' && !finale.active && stable.idx >= STORY.length && !stable.active) spawnFinale();
  updateStable(dz, performance.now() / 1000); updateFinale(dz, dt, performance.now() / 1000);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }

  if (playing || S.state === 'over' || S.state === 'paused') {
    // spawn
    if (playing && !S.dead && !finale.active) { S.nextRow += dz; while (S.nextRow > -170) { spawnRow(S.nextRow); S.nextRow -= rowGap(); } }

    // player physics
    if (!S.dead) {
      const tx = LANES[S.lane]; S.x += (tx - S.x) * (1 - Math.exp(-14 * dt));
      S.vy -= GRAV * dt; S.y += S.vy * dt; if (S.y < 0) { if (S.vy < -5 && playing) emit(S.x, 0.1, 0.2, 6, 0xd9b783, 2, 0.35, 0.4, 0.5); S.y = 0; S.vy = 0; }
      if (S.sliding > 0) S.sliding -= dt;
    }
    // obstacles
    const pb = playerBox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.z += dz + (o.moving && playing && !S.dead ? 9 * dt : 0); o.g.position.z = o.z;
      if (o.moving) { o.g.userData.spr.position.y = Math.abs(Math.sin(animT * 0.9)) * 0.12; o.g.userData.spr.rotation.z = Math.sin(animT * 0.9) * 0.04; }
      if (o.z > 2.5 && !o.wide) o.g.visible = false;
      if (o.z > 18) { o.g.visible = false; obPool[o.type].push(o); obstacles.splice(i, 1); continue; }
      if (!playing || S.dead) continue;
      const b = o.box, zc = o.z + (o.zoff || 0);
      if (pb.x1 > o.x - b.hw && pb.x0 < o.x + b.hw && pb.z1 > zc - b.hd && pb.z0 < zc + b.hd && pb.y1 > b.y0 && pb.y0 < b.y1) {
        if (S.story) { if (!o.hitFx) { o.hitFx = 1; emit(o.x, 1, o.z, 14, 0xd9b783, 4, 0.4, 0.5); } continue; }
        if (GOD || S.power.sandals > 0 || S.invuln > 0) { if (S.power.sandals > 0 && !o.hitFx) { o.hitFx = 1; emit(o.x, 1, o.z, 30, 0xffb050, 7, 0.5, 0.6); } continue; }
        if (S.power.shield > 0) { S.power.shield = 0; S.invuln = 1.2; Sfx.shieldBreak(); emit(S.x, 1.2, 0, 50, 0x7fd0ff, 8, 0.5, 0.8); S.shake = 0.4; toast('Faith Protected You!'); continue; }
        S.dead = 1; S.deadT = 0; Sfx.crash(); S.shake = 0.8; emit(S.x, 1, -0.5, 40, 0xd9b783, 6, 0.6, 0.9);
      }
    }
    // items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.z += dz;
      if (S.power.magnet > 0 && it.kind === 'coin' && it.z > -18 && it.z < 2) it.mag = true;
      if (it.mag && !S.dead) { const k = (1 - Math.exp(-10 * dt)); it.x += (S.x - it.x) * k; it.y += (S.y + 1 - it.y) * k; it.z += (0 - it.z) * k; }
      it.phase += dt;
      it.g.position.set(it.x, it.y + (it.kind === 'coin' ? 0 : Math.sin(it.phase * 3) * 0.15), it.z);
      { const sp = it.g.userData.spr, s0 = ISZ[it.kind]; if (it.kind === 'coin') sp.scale.x = s0 * (0.25 + 0.75 * Math.abs(Math.cos(it.phase * 3))); else sp.rotation.z = Math.sin(it.phase * 2) * 0.12; }
      if (it.g.userData.flame) it.g.userData.flame.scale.y = 1 + Math.sin(it.phase * 20) * 0.2;
      if (it.z > 12) { it.g.visible = false; itemPool[it.kind].push(it); items.splice(i, 1); continue; }
      if (!playing || S.dead) continue;
      if (Math.abs(it.x - S.x) < 0.95 && Math.abs(it.z) < 1.0 && it.y > S.y - 0.3 && it.y < S.y + 2.3) {
        collect(it); it.g.visible = false; itemPool[it.kind].push(it); items.splice(i, 1);
      }
    }
  }
  if (S.dead) { S.deadT += dt; if (S.deadT > 1.3 && S.state === 'play') gameOver(); }
  updateParticles(dt, dz);
  if (S.power.sandals > 0 && playing && Math.random() < 0.8) emit(S.x + rand(-0.2, 0.2), 0.15 + S.y, 0.3, 1, 0xffa040, 1, 0.35, 0.4, 0.5);
  if (playing && S.y === 0 && !S.dead && Math.random() < 0.25) emit(S.x, 0.05, 0.4, 1, 0xc9a06a, 0.6, 0.3, 0.5, 0.6);

  // player animation
  player.position.set(S.x, S.y, 0);
  P.blob.position.x = S.x;
  P.lean = (P.lean || 0) * Math.pow(0.02, dt);
  if (S.dead) { P.setFrame('slide', 1.5); P.body.rotation.z = Math.min(0.5, S.deadT * 2); player.position.z = Math.min(0.8, S.deadT * 2); }
  else {
    const air = S.y > 0.01, sl = S.sliding > 0;
    if (sl) { P.setFrame('slide', 1.4); P.body.position.y = 0; }
    else if (air) { P.setFrame('jump', 2.5); P.body.position.y = 0; }
    else { const f = Math.floor(animT / 1.6) % 2; P.setFrame(f ? 'run1' : 'run0', 2.5); P.body.position.y = Math.abs(Math.sin(animT * 0.98)) * 0.06; }
    P.body.rotation.z = P.lean * 0.07;
  }
  P.blob.scale.setScalar(1 - Math.min(0.6, S.y * 0.2));
  P.shield.visible = S.power.shield > 0 || S.invuln > 0; P.shield.material.opacity = 0.16 + Math.sin(animT * 0.5) * 0.06;
  P.magRing.visible = S.power.magnet > 0; P.magRing.scale.setScalar(1 + Math.sin(animT * 0.6) * 0.15);
  player.visible = !(S.invuln > 0 && Math.floor(S.invuln * 12) % 2);

  // camera
  const fovT = 60 + (speed - BASE_SPEED) * 0.45;
  camera.fov += (Math.min(78, Math.max(58, fovT)) - camera.fov) * (1 - Math.exp(-1.5 * dt)); camera.updateProjectionMatrix();
  if (S.state === 'menu' || S.state === 'loading') { const t = performance.now() * 0.00015; camTarget.set(Math.sin(t) * 1.5, 3.2, 6.5); lookTarget.set(0, 3.5, -40); }
  else { camTarget.set(S.x * 0.65, 3.7 + S.y * 0.35, 6.8); lookTarget.set(S.x * 0.45, 1.3 + S.y * 0.25, -9); }
  camera.position.lerp(camTarget, (1 - Math.exp(-6 * dt))); curLook.lerp(lookTarget, (1 - Math.exp(-7 * dt)));
  if (S.shake > 0) { S.shake -= dt; camera.position.x += rand(-1, 1) * S.shake * 0.4; camera.position.y += rand(-1, 1) * S.shake * 0.3; }
  camera.lookAt(curLook);
  sky.position.copy(camera.position);

  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  if (playing) updateHUD();
}
function collect(it) {
  const x = it.x, y = it.y, z = it.z;
  switch (it.kind) {
    case 'coin': S.coins++; S.score += 10 * S.mult; Sfx.coin(); emit(x, y, z, 10, 0xffd24a, 3, 0.35, 0.45, 1.5); break;
    case 'scroll': S.score += 250 * S.mult; Sfx.item(); emit(x, y, z, 30, 0xfff0c0, 5, 0.45, 0.8); toast('Good Tidings +' + 250 * S.mult); break;
    case 'lamp': S.score += 100 * S.mult; S.coins += 5; Sfx.item(); emit(x, y, z, 30, 0xff9a2e, 5, 0.45, 0.8); toast('Christmas Lantern +' + 100 * S.mult); break;
    default: S.power[it.kind] = DUR[it.kind]; Sfx.power(); emit(x, y, z, 50, PCOL[it.kind], 7, 0.55, 0.9); toast(NAMES[it.kind] + '!');
  }
}

function adaptQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 2.5) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    lowN = fps < 45 ? lowN + 1 : 0;
    if (lowN >= 2 && qualityLevel < 3 && S.state === 'play') { lowN = 0;
      qualityLevel++;
      if (qualityLevel === 1) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
      if (qualityLevel === 2) { pixelRatio = Math.max(1, pixelRatio * 0.75); renderer.setPixelRatio(pixelRatio); onResize(); }
      if (qualityLevel === 3) useOutline = false;
      console.info('[quality] lowered to level', qualityLevel, 'fps', fps.toFixed(1));
    }
  }
}
function onResize() {
  const pr = safePR(Math.min(pixelRatio, Math.min(devicePixelRatio || 1, IS_MOBILE ? 2 : 3))); if (pr !== renderer.getPixelRatio()) renderer.setPixelRatio(pr);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'play') togglePause(); });

function frame() {
  const rawDt = Math.min(1 / 30, clock.getDelta()); sdt += (rawDt - sdt) * 0.2; const dt = sdt;
  if (S.state !== 'paused') update(dt);
  for (const b of billboards) b.rotation.y = b.userData.fixed ?? 0; // fixed facing: no per-frame wobble when the camera moves
  if (useOutline) outline.render(scene, camera); else renderer.render(scene, camera);
  adaptQuality(dt);
  requestAnimationFrame(frame);
}
const _wp = new THREE.Vector3(); let sdt = 1 / 60; if (Q.has('nooutline')) useOutline = false;
S.state = 'menu'; show('loading', false);
// spawn a few attract-mode items on menu
frame();
window.__game = { finale, storyEnd, STORY, stable, W, camera, S, startGame, act, Sfx, renderer };
