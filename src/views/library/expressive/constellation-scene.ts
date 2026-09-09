/**
 * **The Library's constellation, lit** — the object `constellation-model.ts` describes,
 * drawn in WebGL behind the Library's own copy.
 *
 * This file owns materials, the camera, the frame and nothing else. Where the marks go is
 * the model's question and is answered without a GPU; what colour and how bright is this
 * file's, and it reads every value from the design system rather than inventing one.
 *
 * ## The motion, and the one it must not be
 *
 * ⚠️ **The Library already reversed an ambient wriggle once.** On 2026-09-08 the owner
 * killed the 2D graph's 0.28px/7.2s drift — *"why does it wriggle whenever I put the mouse
 * on the graph? it is hard to look at"* — and the rule that survived is that motion on
 * that canvas is only ever the answer to something a person did. That canvas is a picture
 * a person is **reading**; this one is a backdrop behind a title and a button, which is
 * the one place where a slow ambient turn is the point rather than an irritation. The two
 * are kept apart by three things:
 *
 *   - it is **slow** — a full turn takes minutes, not seconds, so nothing crosses the eye
 *     while a sentence is being read;
 *   - it **sleeps** — `ambientSleepFactor` decelerates it to a full stop 30s after the
 *     last input, the same contract the map keeps, so a screen left open costs nothing;
 *   - it **stops dead under reduced motion** — one still frame of the same object, drawn
 *     once, with no loop registered at all.
 *
 * Pointer parallax is deliberately tiny (±0.06 rad). The object should feel like it has
 * depth when a hand moves over it, not follow the cursor.
 *
 * ## Why instanced solids rather than points
 *
 * The owner asked for *geometric shapes*, and a sprite field cannot occlude. Real cubes
 * and spheres pass in front of each other, which is what makes the object read as having
 * a near and a far side — the same reason the download hero draws lit solids rather than
 * the 2D engine's dots. Two `InstancedMesh`es and one `LineSegments` is three draw calls
 * whatever the folder's size, so the cost is flat.
 */

import * as THREE from "three";

import { ambientSleepFactor, isAmbientAsleep } from "@/widgets/ontology-map";

import type { ConstellationModel } from "./constellation-model";

export interface ConstellationHandle {
  /** Redraw with a different folder — the empty state's object becoming the person's. */
  setModel: (model: ConstellationModel) => void;
  dispose: () => void;
}

export interface ConstellationOptions {
  /** Element the design tokens are read from. Defaults to the document root. */
  tokenEl?: Element;
  /** Overrides the media query; the host already knows the answer. */
  reducedMotion?: boolean;
  /**
   * Overall brightness, 0–1. The workbench draws the object under a working screen and
   * takes it down; the empty state has nothing to compete with and leaves it at 1.
   */
  dim?: number;
  /**
   * Camera distance in object radii — larger draws the object smaller.
   *
   * ⚠️ **Brightness alone cannot make a backdrop subordinate.** The workbench's first
   * build reused the empty state's framing at a third of the light and the object still
   * won the screen: a sphere the size of the pane is a subject however dim it is, and its
   * marks landed on the stepper's own type. Size is the axis that decides whether a thing
   * is the ground; `dim` only decides how loud the ground is.
   */
  distance?: number;
}

/** One CSS custom property as a colour, with a literal fallback if the token is absent. */
function cssColor(el: Element, name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  try {
    return new THREE.Color(raw || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

/** Radians per millisecond — one full turn in four minutes. */
const TURN_RATE = (Math.PI * 2) / 240_000;

export function mountLibraryConstellation(
  canvas: HTMLCanvasElement,
  initial: ConstellationModel,
  options: ConstellationOptions = {},
): ConstellationHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    // No WebGL is not an error worth showing anybody: the host keeps its flat panel and
    // the screen is the one that shipped before this file existed.
    return null;
  }

  const tokenEl = options.tokenEl ?? document.documentElement;
  const reduced =
    options.reducedMotion ??
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const dim = options.dim ?? 1;

  const inkSource = cssColor(tokenEl, "--color-text-tertiary", "#8a8b93");
  const inkPage = cssColor(tokenEl, "--color-text-primary", "#f7f8f8");
  const accent = cssColor(tokenEl, "--color-indigo-accent", "#7170ff");
  const line = cssColor(tokenEl, "--color-indigo-brand", "#5e6ad2");

  renderer.setClearColor(0x000000, 0);
  // 1.5 is where an edge stops showing steps on a Retina display; 2 doubles the fill cost
  // for something sitting behind a panel of text.
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  /*
   * Fog is what gives the object a far side. Without it the back half draws at the same
   * brightness as the front and the sphere reads as a flat ring of marks.
   */
  const fog = new THREE.Fog(0x05070c, 2.2, 6.2);
  scene.fog = fog;
  scene.add(new THREE.AmbientLight(0xffffff, 0.9 * dim));
  const key = new THREE.DirectionalLight(0xffffff, 1.8 * dim);
  key.position.set(2, 3, 2.5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 24);
  const camDistance = options.distance ?? 2.95;

  const sourceGeom = new THREE.BoxGeometry(0.062, 0.062, 0.062);
  const pageGeom = new THREE.IcosahedronGeometry(0.046, 2);
  const sourceMat = new THREE.MeshStandardMaterial({
    color: inkSource,
    roughness: 0.55,
    metalness: 0.15,
    transparent: true,
    opacity: 0.92,
  });
  const pageMat = new THREE.MeshStandardMaterial({
    color: inkPage,
    roughness: 0.28,
    metalness: 0.2,
    emissive: accent,
    emissiveIntensity: 0.85 * dim,
    transparent: true,
    opacity: 1,
  });
  const lineMat = new THREE.LineBasicMaterial({
    color: line,
    transparent: true,
    opacity: 0.75 * dim,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  let sources: THREE.InstancedMesh | null = null;
  let pages: THREE.InstancedMesh | null = null;
  let links: THREE.LineSegments | null = null;
  const group = new THREE.Group();
  // The model works in a unit radius; the object reads better a little wider than tall,
  // which is also what keeps its marks out from behind a 640px panel of copy.
  group.scale.set(1.12, 1.12, 1.12);
  scene.add(group);

  const dummy = new THREE.Object3D();

  const clearBuilt = (): void => {
    for (const object of [sources, pages, links]) {
      if (!object) continue;
      group.remove(object);
      object.geometry.dispose?.();
    }
    sources = null;
    pages = null;
    links = null;
  };

  const build = (model: ConstellationModel): void => {
    clearBuilt();
    const pageMarks = model.marks.filter((mark) => mark.kind === "page");
    const sourceMarks = model.marks.filter((mark) => mark.kind === "source");

    if (sourceMarks.length > 0) {
      sources = new THREE.InstancedMesh(sourceGeom, sourceMat, sourceMarks.length);
      sourceMarks.forEach((mark, index) => {
        dummy.position.set(mark.x, mark.y, mark.z);
        // A fixed tumble per index rather than a random one: the object must be identical
        // on every mount, and a cube seen square-on reads as a pixel rather than a solid.
        dummy.rotation.set(index * 0.7, index * 1.1, index * 0.3);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        sources!.setMatrixAt(index, dummy.matrix);
      });
      sources.instanceMatrix.needsUpdate = true;
      group.add(sources);
    }

    if (pageMarks.length > 0) {
      pages = new THREE.InstancedMesh(pageGeom, pageMat, pageMarks.length);
      pageMarks.forEach((mark, index) => {
        dummy.position.set(mark.x, mark.y, mark.z);
        dummy.rotation.set(0, 0, 0);
        // Weight is the object's foreground: the page that gathered the most documents is
        // half again the size of one written from a single file.
        dummy.scale.setScalar(0.85 + mark.weight * 0.75);
        dummy.updateMatrix();
        pages!.setMatrixAt(index, dummy.matrix);
      });
      pages.instanceMatrix.needsUpdate = true;
      group.add(pages);
    }

    if (model.links.length > 0) {
      const positions = new Float32Array(model.links.length * 6);
      model.links.forEach(([pageIndex, sourceIndex], index) => {
        const a = model.marks[pageIndex];
        const b = model.marks[sourceIndex];
        if (!a || !b) return;
        positions.set([a.x, a.y, a.z, b.x, b.y, b.z], index * 6);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      links = new THREE.LineSegments(geometry, lineMat);
      group.add(links);
    }
  };

  build(initial);

  let width = 1;
  let height = 1;
  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  let yaw = 0.6;
  let tiltYaw = 0;
  let tiltPitch = 0;
  let tiltYawTarget = 0;
  let tiltPitchTarget = 0;
  let disposed = false;

  const draw = (): void => {
    const pitch = 0.28 + tiltPitch;
    const angle = yaw + tiltYaw;
    camera.position.set(
      Math.sin(angle) * Math.cos(pitch) * camDistance,
      Math.sin(pitch) * camDistance,
      Math.cos(angle) * Math.cos(pitch) * camDistance,
    );
    camera.lookAt(0, 0, 0);
    fog.near = camDistance - 1.2;
    fog.far = camDistance + 2.6;
    renderer.render(scene, camera);
  };

  let raf = 0;
  let lastInput = performance.now();
  let previous = performance.now();

  const loop = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(64, now - previous);
    previous = now;
    const factor = ambientSleepFactor(now, lastInput);
    // Asleep and settled: nothing has changed, so nothing is drawn. rAF keeps ticking so
    // any input wakes it on the very next frame, which is the map's own conservative rule.
    if (isAmbientAsleep(factor) && Math.abs(tiltYaw - tiltYawTarget) < 1e-4) return;
    yaw += dt * TURN_RATE * factor;
    tiltYaw += (tiltYawTarget - tiltYaw) * 0.06;
    tiltPitch += (tiltPitchTarget - tiltPitch) * 0.06;
    draw();
  };

  const onPointerMove = (event: PointerEvent): void => {
    lastInput = performance.now();
    const rect = canvas.getBoundingClientRect();
    tiltYawTarget = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    tiltPitchTarget = -((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 0.4;
    tiltYawTarget *= 0.12;
    tiltPitchTarget *= 0.12;
  };

  if (reduced) {
    draw();
  } else {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    raf = requestAnimationFrame(loop);
  }

  return {
    setModel: (model: ConstellationModel) => {
      if (disposed) return;
      build(model);
      if (reduced) draw();
      else lastInput = performance.now();
    },
    dispose: () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      observer.disconnect();
      clearBuilt();
      sourceGeom.dispose();
      pageGeom.dispose();
      sourceMat.dispose();
      pageMat.dispose();
      lineMat.dispose();
      renderer.dispose();
    },
  };
}
