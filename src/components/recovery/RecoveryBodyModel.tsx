import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Bounds, Center, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Color, Float32BufferAttribute, Group, Vector3,
  type BufferGeometry, type Mesh, type MeshStandardMaterial,
} from 'three';
import type { MuscleRecoveryState } from '@/lib/recovery/engine';
import type { RecoveryMuscle } from '@/lib/recovery/muscles';
import { MUSCLE_LABELS } from '@/lib/recovery/muscles';

interface RecoveryBodyModelProps {
  muscleStates: MuscleRecoveryState[];
  selectedMuscle: RecoveryMuscle | null;
  onSelectMuscle: (muscle: RecoveryMuscle) => void;
}

interface RegionDef {
  muscle: RecoveryMuscle;
  center: [number, number, number];
  test: (x: number, y: number, z: number) => boolean;
}

// Spatial regions based on the GLB's measured bounds:
// X[-0.39, 0.39], Y[0, 1.9], Z[-0.19, 0.19]
// Ordered most-specific first so smaller regions win over broader ones.
const REGIONS: RegionDef[] = [
  // Measured on body.glb (feet at y=0, head top at y=1.9, arms down by the sides; +z = front).
  // Checked by colouring every vertex and rendering front and back views (2026-10-15).
  { muscle: 'traps', center: [0, 1.53, -0.13], test: (x, y, z) => (y > 1.47 && y < 1.6 && Math.abs(x) < 0.19 && z < 0.06) || (y > 1.38 && y <= 1.47 && Math.abs(x) < 0.13 && z < -0.03) },
  { muscle: 'side_delts', center: [-0.29, 1.41, -0.01], test: (x, y, z) => y > 1.3 && y < 1.52 && Math.abs(x) > 0.25 && Math.abs(z) < 0.035 },
  { muscle: 'front_delts', center: [-0.21, 1.4, 0.06], test: (x, y, z) => y > 1.3 && y < 1.52 && Math.abs(x) > 0.17 && z >= 0 },
  { muscle: 'rear_delts', center: [-0.23, 1.39, -0.13], test: (x, y, z) => y > 1.3 && y < 1.52 && Math.abs(x) > 0.17 && z < 0 },
  { muscle: 'upper_chest', center: [0, 1.45, 0.11], test: (x, y, z) => y > 1.39 && y < 1.5 && Math.abs(x) < 0.17 && z > 0.02 },
  { muscle: 'lower_chest', center: [0, 1.33, 0.12], test: (x, y, z) => y > 1.28 && y <= 1.39 && Math.abs(x) < 0.17 && z > 0.02 },
  { muscle: 'biceps', center: [-0.26, 1.21, 0.03], test: (x, y, z) => y > 1.12 && y <= 1.3 && Math.abs(x) > 0.2 && z >= 0 },
  { muscle: 'triceps', center: [-0.27, 1.21, -0.1], test: (x, y, z) => y > 1.12 && y <= 1.3 && Math.abs(x) > 0.2 && z < 0 },
  { muscle: 'forearms', center: [-0.32, 0.99, 0.08], test: (x, y, _z) => y > 0.88 && y <= 1.12 && Math.abs(x) > 0.23 },
  { muscle: 'abs', center: [0, 1.15, 0.12], test: (x, y, z) => y > 1.04 && y <= 1.28 && Math.abs(x) < 0.085 && z > 0.02 },
  { muscle: 'obliques', center: [-0.12, 1.13, 0.08], test: (x, y, z) => y > 1.04 && y <= 1.28 && Math.abs(x) < 0.2 && z > -0.02 },
  { muscle: 'mid_back', center: [0, 1.32, -0.17], test: (x, y, z) => y > 1.26 && y <= 1.38 && Math.abs(x) < 0.09 && z < -0.02 },
  { muscle: 'lats', center: [-0.15, 1.26, -0.14], test: (x, y, z) => y > 1.1 && y <= 1.38 && Math.abs(x) >= 0.07 && Math.abs(x) < 0.2 && z < -0.02 },
  { muscle: 'lower_back', center: [0, 1.11, -0.14], test: (x, y, z) => y > 1.03 && y <= 1.26 && Math.abs(x) < 0.1 && z < -0.02 },
  { muscle: 'glutes', center: [0, 0.92, -0.14], test: (x, y, z) => y > 0.82 && y <= 1.03 && Math.abs(x) < 0.21 && z < -0.03 },
  { muscle: 'adductors', center: [-0.03, 0.72, 0.03], test: (x, y, _z) => y > 0.58 && y <= 0.8 && Math.abs(x) < 0.075 },
  { muscle: 'quads', center: [-0.12, 0.66, 0.11], test: (x, y, z) => y > 0.52 && y <= 0.82 && Math.abs(x) < 0.25 && z >= 0 },
  { muscle: 'hamstrings', center: [-0.11, 0.68, -0.1], test: (x, y, z) => y > 0.52 && y <= 0.82 && Math.abs(x) < 0.25 && z < 0 },
  { muscle: 'calves', center: [-0.15, 0.33, -0.11], test: (x, y, z) => y > 0.14 && y <= 0.52 && Math.abs(x) < 0.25 && z < -0.01 },
];

function recoveryColorObj(value: number | null): Color {
  if (value == null) return new Color(0.42, 0.48, 0.54);
  if (value <= 50) return new Color('#EF4444');
  if (value <= 85) return new Color('#F59E0B');
  return new Color('#10B981');
}

function detectRegion(x: number, y: number, z: number): RecoveryMuscle | null {
  for (const region of REGIONS) {
    if (region.test(x, y, z)) return region.muscle;
  }
  return null;
}

function FocusController({
  meshRef,
  selectedMuscle,
  controls,
}: {
  meshRef: RefObject<Mesh>;
  selectedMuscle: RecoveryMuscle | null;
  controls: RefObject<OrbitControlsImpl>;
}) {
  const { camera } = useThree();
  const targetWorld = useMemo(() => new Vector3(), []);
  const desiredCam = useMemo(() => new Vector3(), []);
  const focusStart = useRef<number>(0);
  const prevMuscle = useRef<RecoveryMuscle | null>(null);

  useEffect(() => {
    if (selectedMuscle !== prevMuscle.current) {
      focusStart.current = Date.now();
      prevMuscle.current = selectedMuscle;
    }
  }, [selectedMuscle]);

  useFrame(() => {
    if (!selectedMuscle || !meshRef.current || !controls.current) return;
    if (Date.now() - focusStart.current > 1800) return;

    const region = REGIONS.find((r) => r.muscle === selectedMuscle);
    if (!region) return;

    meshRef.current.updateWorldMatrix(true, false);
    targetWorld.set(...region.center);
    meshRef.current.localToWorld(targetWorld);

    const currentDist = camera.position.distanceTo(controls.current.target);
    const desiredDist = Math.min(currentDist, 1.4);
    const dir = camera.position.clone().sub(controls.current.target).normalize();
    desiredCam.copy(targetWorld).add(dir.multiplyScalar(desiredDist));

    controls.current.target.lerp(targetWorld, 0.07);
    camera.position.lerp(desiredCam, 0.05);
    controls.current.update();
  });

  return null;
}

function SelectedRegionLabel({
  meshRef,
  selectedMuscle,
  muscleStates,
}: {
  meshRef: RefObject<Mesh>;
  selectedMuscle: RecoveryMuscle | null;
  muscleStates: MuscleRecoveryState[];
}) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    if (!meshRef.current || !groupRef.current || !selectedMuscle) return;
    const region = REGIONS.find((r) => r.muscle === selectedMuscle);
    if (!region) return;
    meshRef.current.updateWorldMatrix(true, false);
    const worldPos = new Vector3(...region.center);
    meshRef.current.localToWorld(worldPos);
    groupRef.current.position.copy(worldPos);
  });

  if (!selectedMuscle) return null;
  const region = REGIONS.find((r) => r.muscle === selectedMuscle);
  if (!region) return null;
  const state = muscleStates.find((s) => s.muscle === selectedMuscle);
  const value = state?.recoveryPercent ?? null;
  const c = recoveryColorObj(value);
  const hex = `#${c.getHexString()}`;

  return (
    <group ref={groupRef}>
      <Html distanceFactor={3} zIndexRange={[20, 0]}>
        <div
          className="pointer-events-none whitespace-nowrap rounded-md border px-2 py-1 text-[9px] font-black leading-tight shadow-lg backdrop-blur-md"
          style={{ color: hex, borderColor: `${hex}99`, backgroundColor: '#071018ee' }}
        >
          <span className="block">{MUSCLE_LABELS[selectedMuscle]}</span>
          <span>{value == null ? 'NO DATA' : `${Math.round(value)}%`}</span>
        </div>
      </Html>
    </group>
  );
}

function HeatmapScene({ muscleStates, selectedMuscle, onSelectMuscle }: RecoveryBodyModelProps) {
  const gltf = useGLTF('/models/body.glb');
  const controls = useRef<OrbitControlsImpl>(null);
  const meshRef = useRef<Mesh>(null);

  const meshObject = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    let mesh: Mesh | null = null;
    cloned.traverse((o) => {
      if ((o as unknown as { isMesh?: boolean }).isMesh) {
        mesh = o as Mesh;
        mesh.geometry = mesh.geometry.clone();
        const geo = mesh.geometry as BufferGeometry;
        const count = geo.attributes.position.count;
        geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(count * 3), 3));

        const mat = (mesh.material as MeshStandardMaterial).clone();
        mat.vertexColors = true;
        mat.metalness = 0.1;
        mat.roughness = 0.72;
        mat.emissive = new Color(0x000000);
        mesh.material = mat;
      }
    });
    return mesh;
  }, [gltf]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry as BufferGeometry;
    const positions = geo.attributes.position;
    const colors = geo.attributes.color;
    if (!colors) return;

    const stateByMuscle = new Map(muscleStates.map((s) => [s.muscle, s]));
    const base = new Color(0.45, 0.24, 0.14);
    const hairColor = new Color(0.035, 0.022, 0.014);
    const shortsColor = new Color(0.018, 0.022, 0.028);

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const isHair = y > 1.83 || (y > 1.72 && z < -0.005);
      if (isHair) {
        colors.setXYZ(i, hairColor.r, hairColor.g, hairColor.b);
        continue;
      }
      // The shorts stay dark, except over the glutes at the back so glute recovery is visible.
      const isShorts = y > 0.8 && y < 1.06 && Math.abs(x) < 0.215 && !(z < -0.03 && y > 0.82 && y <= 1.03);
      if (isShorts) {
        colors.setXYZ(i, shortsColor.r, shortsColor.g, shortsColor.b);
        continue;
      }
      const region = detectRegion(x, y, z);

      if (region) {
        const state = stateByMuscle.get(region);
        const value = state?.recoveryPercent ?? null;
        const c = recoveryColorObj(value);
        const isSelected = selectedMuscle === region;
        const tint = isSelected ? 0.85 : 0.52;
        colors.setXYZ(
          i,
          c.r * tint + base.r * (1 - tint),
          c.g * tint + base.g * (1 - tint),
          c.b * tint + base.b * (1 - tint),
        );
      } else {
        colors.setXYZ(i, base.r, base.g, base.b);
      }
    }
    colors.needsUpdate = true;

    const mat = mesh.material as MeshStandardMaterial;
    if (selectedMuscle) {
      const state = stateByMuscle.get(selectedMuscle);
      const value = state?.recoveryPercent ?? null;
      const c = recoveryColorObj(value);
      mat.emissive.setRGB(c.r * 0.06, c.g * 0.06, c.b * 0.06);
    } else {
      mat.emissive.setRGB(0, 0, 0);
    }
    mat.needsUpdate = true;
  }, [muscleStates, selectedMuscle]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!meshRef.current) return;
    meshRef.current.updateWorldMatrix(true, false);
    const local = meshRef.current.worldToLocal(event.point.clone());
    const region = detectRegion(local.x, local.y, local.z);
    if (region) onSelectMuscle(region);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!meshRef.current) return;
    meshRef.current.updateWorldMatrix(true, false);
    const local = meshRef.current.worldToLocal(event.point.clone());
    const region = detectRegion(local.x, local.y, local.z);
    document.body.style.cursor = region ? 'pointer' : 'auto';
  };

  if (!meshObject) return null;

  return (
    <>
      <Bounds fit clip observe margin={1.2}>
        <Center>
          <primitive
            ref={meshRef}
            object={meshObject}
            onClick={handleClick}
            onPointerMove={handlePointerMove}
          />
        </Center>
      </Bounds>
      <SelectedRegionLabel meshRef={meshRef} selectedMuscle={selectedMuscle} muscleStates={muscleStates} />
      <FocusController meshRef={meshRef} selectedMuscle={selectedMuscle} controls={controls} />
      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={1.0} maxDistance={8} enablePan />
    </>
  );
}

function LoadingBody() {
  return <Html center className="whitespace-nowrap text-xs font-bold text-[#8ad8f3]">Loading 3D model...</Html>;
}

export function RecoveryBodyModel({ muscleStates, selectedMuscle, onSelectMuscle }: RecoveryBodyModelProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#183744] bg-[#071018]">
      <div className="flex items-center justify-between border-b border-[#183744] px-4 py-3">
        <div>
          <p className="text-[15px] font-black tracking-wide">3D RECOVERY HEATMAP</p>
          <p className="text-[11px] text-cloud-dim">Click any body region to focus and generate a live AI report</p>
        </div>
        <span className="rounded-full border border-[#76d8ed]/40 bg-[#12303b] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#8ad8f3]">LIVE MESH</span>
      </div>
      <div className="h-[440px] touch-none sm:h-[540px]">
        <Canvas camera={{ position: [0, 0.2, 3], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false }}>
          <color attach="background" args={['#071018']} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[3, 5, 4]} intensity={2.2} color="#d9f3ff" />
          <directionalLight position={[-3, 2, -2]} intensity={1.0} color="#4ee18d" />
          <Suspense fallback={<LoadingBody />}>
            <HeatmapScene muscleStates={muscleStates} selectedMuscle={selectedMuscle} onSelectMuscle={onSelectMuscle} />
          </Suspense>
        </Canvas>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#183744] px-4 py-2 text-[10px] text-cloud-dim">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#EF4444]" />Fatigued 0–50%</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#F59E0B]" />Recovering 51–85%</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#10B981]" />Ready 86–100%</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#6b7785]" />No data</span>
      </div>
      <div className="border-t border-[#183744] px-4 py-2 text-[10px] leading-relaxed text-cloud-dim">
        Colors are applied directly to the body mesh surface via procedural vertex coloring. Each region maps to live Supabase recovery scores. Click a region to focus the camera and generate a scientific report.
      </div>
    </div>
  );
}

useGLTF.preload('/models/body.glb');
