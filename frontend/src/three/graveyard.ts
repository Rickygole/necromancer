import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  ExtrudeGeometry,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  Scene,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  BoxGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { disposeTree, glowTexture, makeRenderer, paint, releaseRenderer, rng, runLoop, watchContext } from "./kit";
import { archShape, extrude, fontVar, stoneTexture, type Engraving } from "./stone";

export type { Engraving };

export interface GraveyardOptions {
  engravings: Engraving[];
  hero: HTMLElement | null;
  onReady: () => void;
  onFail: () => void;
  onMove: () => void;
  onThunder: () => void;
}

export interface GraveyardHandle {
  dispose: () => void;
}

const FOG = 0x1a1622;
const START_Z = 6;
const WALK = 35;
const SYNODIC = 29.530588853;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const pathX = (z: number) => Math.sin(z * 0.11) * 1.1;

function groundY(x: number, z: number): number {
  const off = Math.min(1, Math.abs(x - pathX(z)) / 3);
  const n = Math.sin(x * 0.55 + z * 0.21) * 0.5 + Math.sin(x * 1.31 - z * 0.47) * 0.25 + Math.sin(z * 0.9 + x * 0.2) * 0.2;
  return n * 0.28 * off;
}

function gothicShape(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h * 0.68);
  s.quadraticCurveTo(-w / 2, h * 0.93, 0, h);
  s.quadraticCurveTo(w / 2, h * 0.93, w / 2, h * 0.68);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

function slabShape(w: number, h: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h * 0.86);
  s.lineTo(-w * 0.34, h);
  s.lineTo(w * 0.34, h);
  s.lineTo(w / 2, h * 0.86);
  s.lineTo(w / 2, 0);
  s.lineTo(-w / 2, 0);
  return s;
}

function crossShape(w: number, h: number): Shape {
  const a = w * 0.15;
  const s = new Shape();
  s.moveTo(-a, 0);
  s.lineTo(-a, h * 0.62);
  s.lineTo(-w / 2, h * 0.62);
  s.lineTo(-w / 2, h * 0.78);
  s.lineTo(-a, h * 0.78);
  s.lineTo(-a, h);
  s.lineTo(a, h);
  s.lineTo(a, h * 0.78);
  s.lineTo(w / 2, h * 0.78);
  s.lineTo(w / 2, h * 0.62);
  s.lineTo(a, h * 0.62);
  s.lineTo(a, 0);
  s.lineTo(-a, 0);
  return s;
}

function treeGeometry(seed: number): BufferGeometry {
  const r = rng(seed);
  const parts: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const grow = (start: Vector3, dir: Vector3, len: number, rad: number, depth: number) => {
    const end = start.clone().addScaledVector(dir, len);
    const g = new CylinderGeometry(rad * 0.66, rad, len, 5, 1, true);
    const q = new Quaternion().setFromUnitVectors(up, dir);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    g.applyMatrix4(new Matrix4().compose(mid, q, new Vector3(1, 1, 1)));
    parts.push(g);
    if (depth === 0) return;
    const kids = depth >= 4 ? 1 + (r() < 0.6 ? 1 : 0) : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < kids; i += 1) {
      const next = dir
        .clone()
        .add(new Vector3((r() - 0.5) * 1.6, (r() - 0.25) * 0.7, (r() - 0.5) * 1.6))
        .normalize();
      if (next.y < -0.2) next.y = -0.2;
      next.normalize();
      grow(end, next, len * (0.62 + r() * 0.22), rad * 0.64, depth - 1);
    }
  };
  let base = new Vector3(0, -0.2, 0);
  let dir = new Vector3(0, 1, 0);
  for (let i = 0; i < 3; i += 1) {
    const len = 1.1 + r() * 0.3;
    const end = base.clone().addScaledVector(dir, len);
    const g = new CylinderGeometry(0.17 - i * 0.03, 0.22 - i * 0.03, len, 6, 1, true);
    g.applyMatrix4(new Matrix4().compose(base.clone().add(end).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(up, dir), new Vector3(1, 1, 1)));
    parts.push(g);
    base = end;
    dir = dir.clone().add(new Vector3((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)).normalize();
    if (i > 0) grow(base, new Vector3((r() - 0.5) * 2, 0.5, (r() - 0.5) * 2).normalize(), 1.2, 0.09, 4);
  }
  grow(base, dir, 1.0, 0.12, 5);
  const merged = mergeGeometries(parts, false) ?? new BufferGeometry();
  for (const p of parts) p.dispose();
  return merged;
}

function moonTexture(phase: number): CanvasTexture {
  return paint(256, 256, (ctx) => {
    const c = 128;
    const rad = 116;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#3a3640";
    ctx.fillRect(0, 0, 256, 256);
    const k = Math.cos(phase * Math.PI * 2);
    ctx.save();
    if (phase > 0.5) {
      ctx.translate(256, 0);
      ctx.scale(-1, 1);
    }
    ctx.beginPath();
    ctx.moveTo(c, c - rad);
    ctx.arc(c, c, rad, -Math.PI / 2, Math.PI / 2, false);
    ctx.ellipse(c, c, rad * Math.abs(k) + 0.01, rad, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    ctx.closePath();
    const lit = ctx.createRadialGradient(c - 30, c - 30, 10, c, c, rad);
    lit.addColorStop(0, "#fbf3dc");
    lit.addColorStop(0.7, "#ddd0ae");
    lit.addColorStop(1, "#b2a385");
    ctx.fillStyle = lit;
    ctx.fill();
    ctx.restore();
    const craters: Array<[number, number, number]> = [
      [160, 98, 22],
      [104, 150, 30],
      [170, 168, 14],
      [92, 86, 12],
      [136, 200, 10],
    ];
    for (const [x, y, s] of craters) {
      ctx.fillStyle = "rgba(90,78,62,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function cloudTexture(): CanvasTexture {
  const r = rng(77);
  return paint(256, 128, (ctx) => {
    for (let i = 0; i < 22; i += 1) {
      const x = 40 + r() * 176;
      const y = 50 + r() * 40;
      const rad = 20 + r() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 128);
    }
  });
}

function groundTexture(): CanvasTexture {
  const r = rng(5);
  const t = paint(128, 128, (ctx) => {
    ctx.fillStyle = "#7a7a72";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1400; i += 1) {
      const v = (70 + r() * 110) | 0;
      ctx.fillStyle = `rgba(${v},${v},${v - 6},0.5)`;
      ctx.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 3);
    }
  });
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(22, 30);
  return t;
}

function friezeTexture(text: string): CanvasTexture {
  const display = fontVar("--font-display", "Georgia, serif");
  return paint(736, 80, (ctx) => {
    ctx.fillStyle = "#6f6a60";
    ctx.fillRect(0, 0, 736, 80);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 52px ${display}`;
    ctx.fillStyle = "rgba(255,248,230,0.35)";
    ctx.fillText(text, 370, 44);
    ctx.fillStyle = "rgba(24,20,18,0.95)";
    ctx.fillText(text, 368, 42);
  });
}

export function mountGraveyard(canvas: HTMLCanvasElement, host: HTMLElement, options: GraveyardOptions): GraveyardHandle | null {
  const renderer = makeRenderer(canvas, false);
  if (!renderer) return null;

  const r = rng(731942);
  const scene = new Scene();
  scene.background = new Color(FOG);
  scene.fog = new FogExp2(FOG, 0.052);
  const camera = new PerspectiveCamera(50, 1, 0.1, 400);

  const phase = ((((Date.now() - NEW_MOON) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
  const illum = (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const moonDir = new Vector3(-0.04, 0.24, -1).normalize();

  const skyUniforms = {
    top: { value: new Color(0x06050a) },
    horizon: { value: new Color(FOG) },
    glow: { value: new Color(0x6d6070) },
    moonDir: { value: moonDir },
    flash: { value: 0 },
  };
  const sky = new Mesh(
    new SphereGeometry(300, 24, 12),
    new ShaderMaterial({
      uniforms: skyUniforms,
      side: BackSide,
      depthWrite: false,
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 moonDir; uniform float flash; varying vec3 vDir; void main() { vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.5)); float m = max(dot(d, moonDir), 0.0); c += glow * (pow(m, 24.0) * 0.5 + pow(m, 5.0) * 0.08); c += vec3(0.5, 0.55, 0.7) * flash * (0.25 + 0.75 * h) * 0.18; gl_FragColor = vec4(c, 1.0); \n#include <colorspace_fragment>\n }",
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = r() * Math.PI * 2;
    const y = 0.08 + r() * 0.92;
    const s = Math.sqrt(1 - y * y);
    starPos[i * 3] = Math.cos(theta) * s * 260;
    starPos[i * 3 + 1] = y * 260;
    starPos[i * 3 + 2] = Math.sin(theta) * s * 260;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new BufferAttribute(starPos, 3));
  const stars = new Points(starGeo, new PointsMaterial({ color: 0xcfc8e6, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.65, fog: false, depthWrite: false }));
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  scene.add(stars);

  const glow = glowTexture();
  const moon = new Sprite(new SpriteMaterial({ map: moonTexture(phase), fog: false, depthWrite: false, transparent: true }));
  moon.position.copy(moonDir).multiplyScalar(220);
  moon.scale.setScalar(15);
  moon.renderOrder = -8;
  const halo = new Sprite(new SpriteMaterial({ map: glow, color: 0xf3dcae, fog: false, depthWrite: false, transparent: true, opacity: 0.18 + illum * 0.2, blending: AdditiveBlending }));
  halo.position.copy(moon.position).multiplyScalar(1.01);
  halo.scale.setScalar(70);
  halo.renderOrder = -8;
  scene.add(halo, moon);

  const hemi = new HemisphereLight(0x6a6488, 0x16120e, 1.15);
  scene.add(hemi);
  const moonLight = new DirectionalLight(0xb8c4e8, 0.45 + illum * 0.65);
  moonLight.position.set(moonDir.x * 20, 18, moonDir.z * 20);
  scene.add(moonLight);

  const groundGeo = new PlaneGeometry(70, 96, 70, 96);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(0, 0, -16);
  const gp = groundGeo.getAttribute("position");
  const colors = new Float32Array(gp.count * 3);
  const grass = new Color(0x232a1c);
  const dirt = new Color(0x4a3f33);
  const mix = new Color();
  for (let i = 0; i < gp.count; i += 1) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    gp.setY(i, groundY(x, z));
    const d = Math.abs(x - pathX(z));
    const t = Math.min(1, Math.max(0, (1.05 - d) / 0.55));
    mix.copy(grass).lerp(dirt, t * (0.8 + 0.2 * Math.sin(z * 2.3 + x)));
    colors[i * 3] = mix.r;
    colors[i * 3 + 1] = mix.g;
    colors[i * 3 + 2] = mix.b;
  }
  groundGeo.setAttribute("color", new BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new Mesh(groundGeo, new MeshLambertMaterial({ vertexColors: true, map: groundTexture() }));
  scene.add(ground);

  const sideTexture = stoneTexture(rng(3), 1, 1, null);
  sideTexture.repeat.set(1.2, 1.2);
  sideTexture.offset.set(0, 0);
  sideTexture.wrapS = RepeatWrapping;
  sideTexture.wrapT = RepeatWrapping;
  const sideMat = new MeshLambertMaterial({ color: 0x9a9384, map: sideTexture });

  const VARIANTS: Array<[Shape, number, number]> = [
    [archShape(0.8, 1.25), 0.8, 1.25],
    [gothicShape(0.7, 1.4), 0.7, 1.4],
    [slabShape(0.9, 1.0), 0.9, 1.0],
    [crossShape(0.75, 1.5), 0.75, 1.5],
  ];

  type Slot = { x: number; z: number; ry: number; rz: number; rx: number; s: number };
  const slots: Slot[][] = VARIANTS.map(() => []);
  const near: Array<{ x: number; z: number; side: number }> = [];
  for (let z = 3.5; z > -33; z -= 2.5) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k += 1) {
        if (r() < 0.18) continue;
        const x = pathX(z) + side * (1.75 + k * 1.6 + r() * 0.5);
        const zz = z + (r() - 0.5) * 0.9;
        if (k === 0) near.push({ x, z: zz, side });
        const v = Math.floor(r() * VARIANTS.length);
        slots[v].push({ x, z: zz, ry: -side * (0.12 + r() * 0.2) + (r() - 0.5) * 0.2, rz: (r() - 0.5) * 0.14, rx: (r() - 0.5) * 0.12, s: 0.8 + r() * 0.45 });
      }
    }
  }

  const heroSpots: Array<{ x: number; z: number; ry: number; s: number }> = [
    { x: pathX(1.4) + 1.35, z: 1.4, ry: -0.32, s: 1.25 },
    { x: pathX(-5) - 1.45, z: -5, ry: 0.28, s: 1.05 },
    { x: pathX(-11) + 1.5, z: -11, ry: -0.3, s: 1.1 },
    { x: pathX(-17) - 1.5, z: -17, ry: 0.3, s: 1.05 },
    { x: pathX(-23) + 1.45, z: -23, ry: -0.28, s: 1.05 },
    { x: pathX(-28.5) - 1.4, z: -28.5, ry: 0.3, s: 1.0 },
  ];
  const clear = (x: number, z: number) => heroSpots.every((h) => Math.hypot(h.x - x, h.z - z) > 1.05);

  const dummy = new Object3D();
  VARIANTS.forEach(([shape, w, h], v) => {
    const list = slots[v].filter((s) => clear(s.x, s.z));
    if (!list.length) return;
    const face = stoneTexture(rng(11 + v), w, h, null);
    const faceMat = new MeshLambertMaterial({ color: 0xa8a090, map: face, bumpMap: face, bumpScale: 1.2 });
    const mesh = new InstancedMesh(extrude(shape, 0.16), [faceMat, sideMat], list.length);
    const tint = new Color();
    list.forEach((s, i) => {
      dummy.position.set(s.x, groundY(s.x, s.z) - 0.06, s.z);
      dummy.rotation.set(s.rx, s.ry, s.rz);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const g = 0.62 + r() * 0.38;
      mesh.setColorAt(i, tint.setRGB(g, g * (0.96 + r() * 0.05), g * (0.9 + r() * 0.08)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  });

  const heroShape = archShape(0.9, 1.35);
  const heroGeo = extrude(heroShape, 0.2);
  const plinthGeo = new BoxGeometry(1.15, 0.16, 0.42);
  options.engravings.slice(0, heroSpots.length).forEach((engraving, i) => {
    const spot = heroSpots[i];
    const face = stoneTexture(rng(101 + i), 0.9, 1.35, engraving);
    const faceMat = new MeshLambertMaterial({ color: 0xa49d90, map: face, bumpMap: face, bumpScale: 1.6 });
    const group = new Group();
    const stone = new Mesh(heroGeo, [faceMat, sideMat]);
    stone.position.y = 0.12;
    const plinth = new Mesh(plinthGeo, sideMat);
    plinth.position.y = 0.06;
    group.add(stone, plinth);
    group.position.set(spot.x, groundY(spot.x, spot.z) - 0.03, spot.z);
    group.rotation.set(0, spot.ry, (r() - 0.5) * 0.05);
    group.scale.setScalar(spot.s);
    scene.add(group);
  });

  const barkMat = new MeshLambertMaterial({ color: 0x0e0b0c });
  const treeSpots: Array<[number, number, number, number]> = [
    [pathX(2.5) + 4.2, 2.5, 1.35, 0],
    [pathX(-3) - 5.5, -3, 1.2, 1],
    [pathX(-9) + 6.5, -9, 1.3, 1],
    [pathX(-14) - 4.8, -14, 1.15, 0],
    [pathX(-20) + 5.2, -20, 1.4, 0],
    [pathX(-26) - 6, -26, 1.25, 1],
    [pathX(-31) + 4.5, -31, 1.1, 1],
    [pathX(-6) + 9.5, -6, 1.5, 0],
  ];
  [treeGeometry(19), treeGeometry(42)].forEach((geo, v) => {
    const list = treeSpots.filter((t) => t[3] === v);
    const mesh = new InstancedMesh(geo, barkMat, list.length);
    list.forEach(([x, z, s], i) => {
      dummy.position.set(x, groundY(x, z) - 0.1, z);
      dummy.rotation.set(0, r() * Math.PI * 2, (r() - 0.5) * 0.12);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  });

  const cryptZ = -38;
  const crypt = new Group();
  const cryptStone = new MeshLambertMaterial({ color: 0x77716a, map: sideTexture });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: MeshLambertMaterial | MeshBasicMaterial = cryptStone) => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    crypt.add(m);
    return m;
  };
  box(4.6, 0.3, 3.6, 0, 0.15, 0);
  box(4.2, 0.2, 3.3, 0, 0.4, 0.05);
  box(3.6, 2.6, 2.8, 0, 1.8, -0.1);
  box(4.0, 0.28, 3.1, 0, 3.2, -0.05);
  const roofShape = new Shape();
  roofShape.moveTo(-2.1, 0);
  roofShape.lineTo(0, 1.05);
  roofShape.lineTo(2.1, 0);
  roofShape.lineTo(-2.1, 0);
  const roof = new Mesh(new ExtrudeGeometry(roofShape, { depth: 3.1, bevelEnabled: false }), cryptStone);
  roof.position.set(0, 3.34, -1.6);
  crypt.add(roof);
  const columnGeo = new CylinderGeometry(0.14, 0.17, 2.6, 10);
  for (const cx of [-1.55, -0.8, 0.8, 1.55]) {
    const col = new Mesh(columnGeo, cryptStone);
    col.position.set(cx, 1.8, 1.42);
    crypt.add(col);
  }
  box(1.05, 1.9, 0.08, 0, 1.45, 1.32, new MeshLambertMaterial({ color: 0x0b0908 }));
  const frieze = new Mesh(new PlaneGeometry(2.4, 0.26), new MeshLambertMaterial({ map: friezeTexture("THE ORACLE"), color: 0xc8c0b0 }));
  frieze.position.set(0, 3.2, 1.515);
  crypt.add(frieze);
  const doorGlow = new Sprite(new SpriteMaterial({ map: glow, color: 0x9fd162, transparent: true, opacity: 0.18, depthWrite: false, blending: AdditiveBlending }));
  doorGlow.position.set(0, 1.0, 1.45);
  doorGlow.scale.set(1.6, 2.2, 1);
  crypt.add(doorGlow);
  crypt.position.set(pathX(cryptZ), groundY(pathX(cryptZ), cryptZ) - 0.1, cryptZ);
  scene.add(crypt);

  const figureZ = -33.6;
  const figure = new Group();
  const robe = new Mesh(
    new LatheGeometry(
      [
        new Vector2(0.001, 0),
        new Vector2(0.46, 0),
        new Vector2(0.4, 0.35),
        new Vector2(0.31, 0.9),
        new Vector2(0.26, 1.25),
        new Vector2(0.27, 1.42),
        new Vector2(0.15, 1.55),
        new Vector2(0.001, 1.58),
      ],
      18,
    ),
    new MeshLambertMaterial({ color: 0x0c0a0e }),
  );
  const hood = new Mesh(new SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), robe.material);
  hood.position.set(0, 1.6, 0.02);
  hood.rotation.x = 0.35;
  const face = new Mesh(new SphereGeometry(0.16, 12, 8), new MeshBasicMaterial({ color: 0x020203 }));
  face.position.set(0, 1.58, 0.1);
  face.scale.set(1, 1.1, 0.6);
  const eyeMat = new SpriteMaterial({ map: glow, color: 0xffb36b, transparent: true, opacity: 0.7, depthWrite: false, blending: AdditiveBlending });
  [-0.055, 0.055].forEach((ex) => {
    const eye = new Sprite(eyeMat);
    eye.position.set(ex, 1.6, 0.22);
    eye.scale.setScalar(0.07);
    figure.add(eye);
  });
  figure.add(robe, hood, face);
  figure.position.set(pathX(figureZ) + 0.35, groundY(pathX(figureZ), figureZ), figureZ);
  figure.rotation.y = -0.12;
  scene.add(figure);

  const candleSpots: Vector3[] = [];
  heroSpots.forEach((spot, i) => {
    const toward = spot.x > pathX(spot.z) ? -1 : 1;
    candleSpots.push(new Vector3(spot.x + toward * 0.55, 0, spot.z + 0.42));
    if (i % 2 === 0) candleSpots.push(new Vector3(spot.x + toward * 0.25, 0, spot.z + 0.6));
  });
  near.filter((_, i) => i % 4 === 1).forEach((n) => candleSpots.push(new Vector3(n.x - n.side * 0.4, 0, n.z + 0.45)));
  candleSpots.push(new Vector3(pathX(cryptZ) - 0.9, 0, cryptZ + 2.4), new Vector3(pathX(cryptZ) + 0.9, 0, cryptZ + 2.4));
  for (const c of candleSpots) c.y = groundY(c.x, c.z);
  const wax = new InstancedMesh(new CylinderGeometry(0.035, 0.042, 0.24, 8), new MeshLambertMaterial({ color: 0xe6dcc4, emissive: 0x3a2a14 }), candleSpots.length);
  const flameCount = candleSpots.length * 2;
  const flamePos = new Float32Array(flameCount * 3);
  const flameSize = new Float32Array(flameCount);
  const flamePhase = new Float32Array(flameCount);
  const flameTint = new Float32Array(flameCount * 3);
  const flameColor = new Color(0xffb04a);
  const haloColor = new Color(0xe8791d).multiplyScalar(0.22);
  candleSpots.forEach((c, i) => {
    const h = 0.8 + ((i * 37) % 10) / 20;
    dummy.position.set(c.x, c.y + 0.12 * h, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    wax.setMatrixAt(i, dummy.matrix);
    const y = c.y + 0.24 * h + 0.06;
    for (let k = 0; k < 2; k += 1) {
      const j = i * 2 + k;
      flamePos.set([c.x, y, c.z], j * 3);
      flameSize[j] = k === 0 ? 0.2 : 0.9;
      flamePhase[j] = i * 2.1;
      const tint = k === 0 ? flameColor : haloColor;
      flameTint.set([tint.r, tint.g, tint.b], j * 3);
    }
  });
  const flameGeo = new BufferGeometry();
  flameGeo.setAttribute("position", new BufferAttribute(flamePos, 3));
  flameGeo.setAttribute("size", new BufferAttribute(flameSize, 1));
  flameGeo.setAttribute("phase", new BufferAttribute(flamePhase, 1));
  flameGeo.setAttribute("tint", new BufferAttribute(flameTint, 3));
  const flameUniforms = { map: { value: glow }, time: { value: 0 }, scale: { value: 400 } };
  const flames = new Points(
    flameGeo,
    new ShaderMaterial({
      uniforms: flameUniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader:
        "attribute float size; attribute float phase; attribute vec3 tint; uniform float time; uniform float scale; varying vec3 vTint; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float f = 1.0 + 0.08 * sin(time * 2.3 + phase) + 0.05 * sin(time * 1.1 + phase * 0.7); gl_PointSize = size * f * scale / -mv.z; gl_Position = projectionMatrix * mv; vTint = tint; }",
      fragmentShader:
        "uniform sampler2D map; varying vec3 vTint; void main() { vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vTint * c.rgb, c.a); \n#include <colorspace_fragment>\n }",
    }),
  );
  flames.frustumCulled = false;
  scene.add(flames);
  wax.instanceMatrix.needsUpdate = true;
  scene.add(wax);

  const lights = Array.from({ length: 4 }, () => {
    const light = new PointLight(0xff9a3c, 0, 7, 2);
    scene.add(light);
    return light;
  });

  const cloud = cloudTexture();
  const fogSprites: Sprite[] = [];
  for (let i = 0; i < 12; i += 1) {
    const z = 4 - i * 3.3 + r();
    const s = new Sprite(new SpriteMaterial({ map: cloud, color: 0xb6aac8, transparent: true, opacity: 0.16 + r() * 0.08, depthWrite: false }));
    s.position.set(pathX(z) + (r() - 0.5) * 6, 0.35 + r() * 0.5, z);
    s.scale.set(7 + r() * 4, 2 + r() * 1.2, 1);
    s.userData.base = s.position.x;
    s.userData.speed = 0.05 + r() * 0.08;
    s.userData.phase = r() * 6;
    fogSprites.push(s);
    scene.add(s);
  }

  const emberCount = 150;
  const emberPos = new Float32Array(emberCount * 3);
  const emberCol = new Float32Array(emberCount * 3);
  const emberSeed = new Float32Array(emberCount * 3);
  const ember = new Color();
  for (let i = 0; i < emberCount; i += 1) {
    emberPos[i * 3] = (r() - 0.5) * 12;
    emberPos[i * 3 + 1] = r() * 4;
    emberPos[i * 3 + 2] = START_Z + 1 - r() * 16;
    emberSeed[i * 3] = 0.15 + r() * 0.35;
    emberSeed[i * 3 + 1] = r() * 6.28;
    emberSeed[i * 3 + 2] = 0.3 + r() * 0.6;
    if (r() < 0.2) ember.setHex(0xcfe8c0);
    else ember.setHex(r() < 0.5 ? 0xf3a24b : 0xe8791d);
    emberCol[i * 3] = ember.r;
    emberCol[i * 3 + 1] = ember.g;
    emberCol[i * 3 + 2] = ember.b;
  }
  const emberGeo = new BufferGeometry();
  const emberAttr = new BufferAttribute(emberPos, 3);
  emberAttr.setUsage(DynamicDrawUsage);
  emberGeo.setAttribute("position", emberAttr);
  emberGeo.setAttribute("color", new BufferAttribute(emberCol, 3));
  const embers = new Points(emberGeo, new PointsMaterial({ map: glow, size: 0.1, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: AdditiveBlending }));
  embers.frustumCulled = false;
  scene.add(embers);

  const wing = new Shape();
  wing.moveTo(0, 0.02);
  wing.quadraticCurveTo(0.16, 0.1, 0.34, 0.03);
  wing.lineTo(0.27, -0.02);
  wing.quadraticCurveTo(0.24, -0.06, 0.19, -0.03);
  wing.quadraticCurveTo(0.15, -0.08, 0.1, -0.04);
  wing.quadraticCurveTo(0.05, -0.08, 0, -0.04);
  const wingR = new ShapeGeometry(wing, 4);
  wingR.rotateX(-Math.PI / 2);
  const wingL = wingR.clone();
  wingL.scale(-1, 1, 1);
  const bodyGeo = new SphereGeometry(0.055, 8, 6);
  bodyGeo.scale(0.9, 0.8, 1.7);
  const batMat = new MeshBasicMaterial({ color: 0x040306, side: DoubleSide });
  const batCount = 9;
  const bodies = new InstancedMesh(bodyGeo, batMat, batCount);
  const lefts = new InstancedMesh(wingL, batMat, batCount);
  const rights = new InstancedMesh(wingR, batMat, batCount);
  for (const m of [bodies, lefts, rights]) {
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
  }
  const bats = Array.from({ length: batCount }, (_, i) => ({
    ax: 2.5 + r() * 3,
    ay: 0.6 + r() * 0.9,
    az: 2 + r() * 3,
    w: 0.25 + r() * 0.3,
    p: r() * 6.28,
    flap: 5 + r() * 2.5,
    lead: 7 + i * 1.6 + r() * 2,
    y: 2.6 + r() * 2.4,
  }));
  const batPos = new Vector3();
  const batNext = new Vector3();
  const flapMat = new Matrix4();
  const tmp = new Matrix4();

  let width = 0;
  let height = 0;
  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 62 : 50;
    if (aspect > 1.1) camera.setViewOffset(width * 2 * 0.64, height, 0, 0, width, height);
    else camera.setViewOffset(width, height * 2 * 0.6, 0, 0, width, height);
    camera.updateProjectionMatrix();
    const fullHeight = camera.view ? camera.view.fullHeight : height;
    flameUniforms.scale.value = (fullHeight * renderer.getPixelRatio()) / 2 / Math.tan((camera.fov * Math.PI) / 360);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let target = 0;
  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    target = Math.min(1, Math.max(0, window.scrollY / max));
    const vh = window.innerHeight;
    const bottom = options.hero ? options.hero.getBoundingClientRect().bottom : vh - window.scrollY;
    const veil = Math.min(1, Math.max(0, (vh * 0.95 - bottom) / (vh * 0.5)));
    host.style.setProperty("--veil", veil.toFixed(2));
  };
  readScroll();
  let pointer = { x: 0, y: 0 };
  let aim = { x: 0, y: 0 };
  let pointerAt = -10;
  const onPointer = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pointerAt = performance.now() / 1000;
    pointer = { x: (event.clientX / window.innerWidth) * 2 - 1, y: (event.clientY / window.innerHeight) * 2 - 1 };
  };
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("resize", readScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });

  let walk = target;
  let stillFor = 10;
  let moving = false;
  let nextBolt = 14 + r() * 20;
  let boltAt = -100;
  let ready = false;
  const look = new Vector3();
  const lightOrder = candleSpots.map((_, i) => i);
  let lastFocus = Infinity;
  let pending = 0;
  let skip = false;

  const frame = (t: number, step: number) => {
    pending += step;
    const idle = ready && !moving && stillFor > 2 && t - pointerAt > 2 && t - boltAt > 2;
    skip = idle && !skip;
    if (skip) return;
    const dt = Math.min(pending, 0.1);
    pending = 0;
    const k = 1 - Math.exp(-dt * 2.6);
    const gap = target - walk;
    walk += gap * k;
    const speed = Math.abs(gap);
    if (speed > 0.004) {
      if (!moving && stillFor > 1.5) options.onMove();
      moving = true;
      stillFor = 0;
    } else if (speed < 0.001) {
      moving = false;
      stillFor += dt;
    }
    const kp = 1 - Math.exp(-dt * 3);
    aim = { x: aim.x + (pointer.x - aim.x) * kp, y: aim.y + (pointer.y - aim.y) * kp };

    const cz = START_Z - walk * WALK;
    const driftX = Math.sin(t * 0.13) * 0.14 + Math.sin(t * 0.07) * 0.08;
    const driftY = Math.sin(t * 0.21) * 0.05;
    camera.position.set(pathX(cz) + driftX + aim.x * 0.4, 1.55 + groundY(pathX(cz), cz) * 0.5 + driftY - aim.y * 0.18, cz);
    look.set(pathX(cz - 8) + aim.x * 0.7 + driftX * 0.5, 1.15 - aim.y * 0.25, cz - 8);
    camera.lookAt(look);

    if (t > nextBolt) {
      boltAt = t;
      nextBolt = t + 22 + r() * 26;
      options.onThunder();
    }
    const since = t - boltAt;
    const bolt = since < 0 ? 0 : since < 0.12 ? since / 0.12 : Math.exp(-(since - 0.12) / 0.35);
    hemi.intensity = 1.15 * (1 + bolt * 0.9);
    skyUniforms.flash.value = bolt;

    const focus = cz - 3;
    if (Math.abs(focus - lastFocus) > 0.25) {
      lastFocus = focus;
      lightOrder.sort((a, b) => Math.abs(candleSpots[a].z - focus) - Math.abs(candleSpots[b].z - focus));
      lights.forEach((light, i) => {
        const c = candleSpots[lightOrder[i]];
        light.position.set(c.x, c.y + 0.4, c.z);
      });
    }
    lights.forEach((light, i) => {
      light.intensity = 1.5 * (0.92 + Math.sin(t * 2.7 + i * 1.7) * 0.04 + Math.sin(t * 1.3 + i) * 0.04);
    });
    flameUniforms.time.value = t;

    for (const s of fogSprites) {
      s.position.x = s.userData.base + Math.sin(t * s.userData.speed + s.userData.phase) * 1.4;
    }

    const minZ = cz - 15;
    const maxZ = cz + 1;
    for (let i = 0; i < emberCount; i += 1) {
      const j = i * 3;
      emberPos[j + 1] += emberSeed[j] * dt;
      emberPos[j] += Math.sin(t * emberSeed[j + 2] + emberSeed[j + 1]) * dt * 0.12;
      if (emberPos[j + 1] > 4.2) emberPos[j + 1] = 0.05;
      if (emberPos[j + 2] > maxZ) emberPos[j + 2] -= 16;
      else if (emberPos[j + 2] < minZ) emberPos[j + 2] += 16;
    }
    emberAttr.needsUpdate = true;
    const emberBase = pathX(cz - 6);
    embers.position.x = emberBase;

    bats.forEach((b, i) => {
      const center = cz - b.lead;
      const at = (time: number) =>
        batPos.set(
          pathX(center) + Math.sin(time * b.w + b.p) * b.ax,
          b.y + Math.sin(time * b.w * 1.7 + b.p) * b.ay,
          center + Math.sin(time * b.w * 0.8 + b.p * 2) * b.az,
        );
      at(t + 0.05);
      batNext.copy(batPos);
      at(t);
      dummy.position.copy(batPos);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.lookAt(batNext);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      const a = Math.sin(t * Math.PI * 2 * b.flap * 0.5 + b.p) * 0.75;
      rights.setMatrixAt(i, tmp.multiplyMatrices(dummy.matrix, flapMat.makeRotationZ(a)));
      lefts.setMatrixAt(i, tmp.multiplyMatrices(dummy.matrix, flapMat.makeRotationZ(-a)));
    });
    bodies.instanceMatrix.needsUpdate = true;
    lefts.instanceMatrix.needsUpdate = true;
    rights.instanceMatrix.needsUpdate = true;

    const eyeGlow = 0.55 + Math.sin(t * 0.9) * 0.2;
    eyeMat.opacity = eyeGlow;
    doorGlow.material.opacity = 0.14 + Math.sin(t * 0.4) * 0.05;

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady();
    }
  };

  const onLevel = (level: number) => {
    if (level === 1) renderer.setPixelRatio(1);
    if (level >= 2) {
      renderer.setPixelRatio(0.75);
      for (const s of fogSprites.slice(6)) s.visible = false;
      emberGeo.setDrawRange(0, emberCount / 2);
    }
    resize();
  };

  let disposed = false;
  const loop = runLoop(host, frame, onLevel);
  const unwatch = watchContext(canvas, () => {
    if (!disposed) options.onFail();
  });

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      loop.dispose();
      unwatch();
      ro.disconnect();
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", readScroll);
      window.removeEventListener("pointermove", onPointer);
      disposeTree(scene);
      heroGeo.dispose();
      wingL.dispose();
      releaseRenderer(renderer);
    },
  };
}
