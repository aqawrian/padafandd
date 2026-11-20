import * as THREE from 'three';
import { DefenseTower, EnemyUnit } from '../types/game';
import { buildEnemy3D, buildTower3D } from './meshFactory';
import { disposeObject3D } from './mapBuilder';

/**
 * Lightweight Offscreen Three.js Studio Portrait Renderer for Equipment Encyclopedia
 * Renders real in-game 3D tower and enemy unit meshes under 3-point studio lighting
 * into cached PNG data URLs, then immediately disposes the temporary WebGL context.
 */

const thumbnailCache = new Map<string, string>();

export function renderUnitThumbnailsBatch(
  towers: DefenseTower[],
  enemies: EnemyUnit[]
): Record<string, string> {
  const results: Record<string, string> = {};

  // Check if all requested units are already cached
  let missingAny = false;
  for (const t of towers) {
    const key = `tower:${t.id}`;
    const cached = thumbnailCache.get(key);
    if (cached) results[key] = cached;
    else missingAny = true;
  }
  for (const e of enemies) {
    const key = `enemy:${e.id}`;
    const cached = thumbnailCache.get(key);
    if (cached) results[key] = cached;
    else missingAny = true;
  }
  if (!missingAny) return results;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const width = 320;
    const height = 210;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;

    const scene = new THREE.Scene();

    // 3-Point Military Studio Lighting
    const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x1e293b, 1.35);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const warmFill = new THREE.DirectionalLight(0xf59e0b, 0.65);
    warmFill.position.set(-4, -2, 5);
    scene.add(warmFill);

    // Subtle circular studio pedestal disc for towers only
    const stageDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.75, 1.88, 0.08, 24),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.72,
        metalness: 0.35,
      })
    );
    stageDisc.position.y = -0.05;
    scene.add(stageDisc);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 80);

    const captureObject = (
      root: THREE.Object3D,
      azimuthRad: number,
      elevationRad: number,
      showStage: boolean,
      zoomFactor = 1.18
    ): string => {
      stageDisc.visible = showStage;
      scene.add(root);
      root.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(root);
      const center = new THREE.Vector3();
      const sphere = new THREE.Sphere();
      box.getCenter(center);
      box.getBoundingSphere(sphere);

      const radius = Math.max(0.44, sphere.radius);
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const dist = (radius / Math.sin(fovRad / 2)) * zoomFactor;

      const cosEl = Math.cos(elevationRad);
      camera.position.set(
        center.x + Math.sin(azimuthRad) * cosEl * dist,
        center.y + Math.sin(elevationRad) * dist,
        center.z + Math.cos(azimuthRad) * cosEl * dist
      );
      camera.lookAt(center);

      renderer!.clear();
      renderer!.render(scene, camera);
      const dataUrl = canvas.toDataURL('image/png');

      scene.remove(root);
      disposeObject3D(root);
      return dataUrl;
    };

    // 1. Render all Defense Towers at Level 2 showcase hardware (hero angle)
    for (const tower of towers) {
      const key = `tower:${tower.id}`;
      if (thumbnailCache.has(key)) continue;
      const rig = buildTower3D(tower, 2);
      rig.turretHead.rotation.y = 0.25;
      const url = captureObject(rig.group, 0.68, 0.42, true, 1.14);
      thumbnailCache.set(key, url);
      results[key] = url;
    }

    // 2. Render all Airborne Enemies in heroic banked flight pose (health bar hidden)
    for (const enemy of enemies) {
      const key = `enemy:${enemy.id}`;
      if (thumbnailCache.has(key)) continue;
      const rig = buildEnemy3D(enemy);
      rig.healthBar.mesh.visible = false;
      rig.group.rotation.set(0.14, 0.32, -0.22);
      const url = captureObject(rig.group, 0.62, 0.34, false, 1.16);
      thumbnailCache.set(key, url);
      results[key] = url;
    }

    disposeObject3D(stageDisc);
  } catch {
    // Graceful fallback if WebGL context limit is hit — SVG silhouettes render cleanly
  } finally {
    if (renderer) {
      try {
        renderer.dispose();
        const gl = renderer.getContext();
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // ignore
      }
    }
  }

  return results;
}
