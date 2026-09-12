import * as THREE from 'three';
import type { OrganId, OrganVisualState } from '../types';

export class SceneManager {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private particles: THREE.Points | null = null;
  private core: THREE.Mesh | null = null;
  private rings: THREE.Group | null = null;
  private frame: number | null = null;
  private progress = 0; private targetProgress = 0;
  private pointerX = 0; private pointerY = 0; private targetPointerX = 0; private targetPointerY = 0;
  private reducedMotion = false;

  constructor(private readonly canvas: HTMLCanvasElement) { this.init(); }
  private init() {
    const width = this.canvas.clientWidth || window.innerWidth, height = this.canvas.clientHeight || window.innerHeight;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x02070b); this.scene.fog = new THREE.FogExp2(0x02070b, .035);
    this.camera = new THREE.PerspectiveCamera(45, width / height, .1, 100); this.camera.position.set(0, 0, 18);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }); this.renderer.setSize(width, height, false); this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.add(new THREE.AmbientLight(0x0d2b45, 1.5)); const cyan = new THREE.DirectionalLight(0x00f0ff, 2); cyan.position.set(5, 10, 7); this.scene.add(cyan); const violet = new THREE.DirectionalLight(0x7000ff, 1.5); violet.position.set(-5, -5, 5); this.scene.add(violet);
    this.createParticles(); this.createCore(); this.tick = this.tick.bind(this); this.frame = requestAnimationFrame(this.tick);
  }
  private createParticles() {
    if (!this.scene) return; const count = 700, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3); const palette = [new THREE.Color(0x00f0ff), new THREE.Color(0x7000ff), new THREE.Color(0x00ff88)];
    for (let i = 0; i < count; i++) { const radius = 5 + Math.random() * 20, theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * 2 - 1), color = palette[Math.floor(Math.random() * palette.length)]; positions.set([radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi)], i * 3); colors.set([color.r, color.g, color.b], i * 3); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .14, vertexColors: true, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(this.particles);
  }
  private createCore() {
    if (!this.scene) return; this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 3), new THREE.MeshStandardMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .28, roughness: .3, metalness: .8 })); this.scene.add(this.core); this.rings = new THREE.Group(); const r1 = new THREE.Mesh(new THREE.TorusGeometry(3.6, .02, 16, 100), new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: .35 })); r1.rotation.x = Math.PI / 3; const r2 = new THREE.Mesh(new THREE.TorusGeometry(4.4, .02, 16, 100), new THREE.MeshBasicMaterial({ color: 0x7000ff, wireframe: true, transparent: true, opacity: .3 })); r2.rotation.y = Math.PI / 4; this.rings.add(r1, r2); this.scene.add(this.rings);
  }
  private tick(time: number) { if (!this.renderer || !this.scene || !this.camera) return; this.progress += (this.targetProgress - this.progress) * .08; this.pointerX += (this.targetPointerX - this.pointerX) * .05; this.pointerY += (this.targetPointerY - this.pointerY) * .05; if (!this.reducedMotion) { const t = time * .0008; if (this.particles) { this.particles.rotation.y = t * .15 + this.progress * Math.PI * 1.5; this.particles.rotation.x = t * .08; } if (this.core) { this.core.rotation.y = -t * .2 + this.progress * Math.PI; this.core.rotation.x = Math.sin(t * .5) * .2; } if (this.rings) { this.rings.rotation.z = t * .1; this.rings.rotation.x = Math.PI / 6 + this.progress * Math.PI * .5; } this.camera.position.set(this.pointerX * 1.5, -this.pointerY * 1.5, 18 - this.progress * 6); this.camera.lookAt(0, 0, 0); } this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.tick); }
  setProgress(value: number) { this.targetProgress = Math.max(0, Math.min(1, value)); }
  setPointer(x: number, y: number) { this.targetPointerX = x; this.targetPointerY = y; }
  setReducedMotion(value: boolean) { this.reducedMotion = value; }
  setActiveOrgan(_organId: OrganId | undefined) {}
  setOrganState(_organId: OrganId | string, _state: OrganVisualState) {}
  resize(width: number, height: number) { if (this.camera) { this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); } this.renderer?.setSize(width, height, false); }
  dispose() { if (this.frame !== null) cancelAnimationFrame(this.frame); this.scene?.traverse((object: THREE.Object3D) => { const mesh = object as THREE.Mesh; mesh.geometry?.dispose(); const material = mesh.material as THREE.Material | THREE.Material[]; (Array.isArray(material) ? material : [material]).forEach((entry) => entry?.dispose()); }); this.renderer?.dispose(); this.renderer = null; this.scene = null; this.camera = null; }
}
