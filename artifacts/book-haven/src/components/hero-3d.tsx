import { useRef, useMemo, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

type BookSpec = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
  spineAccent: string;
  ribbon?: string;
  hasGoldBands?: boolean;
};

function LeatherBook({ position, rotation, scale, color, spineAccent, ribbon, hasGoldBands }: BookSpec) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Page block — slightly inset, off-white */}
      <mesh position={[0.06, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.26, 1.4]} />
        <meshStandardMaterial color="#f1e6cc" roughness={1} />
      </mesh>

      {/* Page edge lines — gold-ish gilded edges */}
      <mesh position={[0.06, 0.14, 0]} castShadow>
        <boxGeometry args={[1.86, 0.005, 1.4]} />
        <meshStandardMaterial color="#cfa64a" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[0.06, -0.14, 0]} castShadow>
        <boxGeometry args={[1.86, 0.005, 1.4]} />
        <meshStandardMaterial color="#cfa64a" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Cover — physical material gives leather a soft sheen */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 0.34, 1.5]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.62}
          clearcoat={0.35}
          clearcoatRoughness={0.55}
          sheen={0.5}
          sheenRoughness={0.7}
          sheenColor={spineAccent}
        />
      </mesh>

      {/* Spine gold trim — top band */}
      {hasGoldBands && (
        <>
          <mesh position={[-1.005, 0.1, 0]} castShadow>
            <boxGeometry args={[0.02, 0.04, 1.46]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.22} />
          </mesh>
          <mesh position={[-1.005, -0.1, 0]} castShadow>
            <boxGeometry args={[0.02, 0.04, 1.46]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.22} />
          </mesh>
        </>
      )}

      {/* Spine title plaque (recessed gold rectangle) */}
      <mesh position={[-1.005, 0, 0]} castShadow>
        <boxGeometry args={[0.018, 0.18, 0.62]} />
        <meshStandardMaterial color="#b8923f" metalness={0.85} roughness={0.32} />
      </mesh>
      <mesh position={[-1.014, 0, 0]} castShadow>
        <boxGeometry args={[0.005, 0.13, 0.5]} />
        <meshStandardMaterial color="#5a3712" roughness={0.85} />
      </mesh>

      {/* Front cover crest — small gold detail */}
      <mesh position={[1.001, 0, 0.45]} castShadow>
        <boxGeometry args={[0.01, 0.03, 0.4]} />
        <meshStandardMaterial color="#cfa64a" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[1.001, 0, -0.45]} castShadow>
        <boxGeometry args={[0.01, 0.03, 0.4]} />
        <meshStandardMaterial color="#cfa64a" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Bookmark ribbon hanging out the top */}
      {ribbon && (
        <mesh position={[0.55, -0.32, 0.01]} rotation={[0, 0, 0.04]} castShadow>
          <boxGeometry args={[0.08, 0.85, 0.006]} />
          <meshStandardMaterial color={ribbon} roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function BookStack() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.28) * 0.45;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.05;
    }
  });

  const books: BookSpec[] = useMemo(() => [
    { position: [0, -0.95, 0], rotation: [0, 0.12, 0], scale: 1.22, color: "#1f3326",  spineAccent: "#3f5e3a", hasGoldBands: true,                     },
    { position: [0.05, -0.34, 0], rotation: [0, -0.18, 0], scale: 1.12, color: "#5a1d1d", spineAccent: "#7c2929", hasGoldBands: true, ribbon: "#caa45a" },
    { position: [-0.05, 0.25, 0], rotation: [0, 0.10, 0],  scale: 1.06, color: "#8b6b45", spineAccent: "#a98852", hasGoldBands: true                    },
    { position: [0.04, 0.78, 0],  rotation: [0, -0.06, 0], scale: 0.98, color: "#1c1c22", spineAccent: "#3a3a48", hasGoldBands: true, ribbon: "#a83a3a" },
    { position: [-0.02, 1.27, 0], rotation: [0, 0.04, 0],  scale: 0.92, color: "#2e3a55", spineAccent: "#4a5b80",                                       },
  ], []);

  return (
    <group ref={group}>
      {books.map((b, i) => <LeatherBook key={i} {...b} />)}
    </group>
  );
}

function FallbackHero() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(195,159,97,0.18),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,_rgba(74,28,28,0.35),_transparent_55%)]" />
    </div>
  );
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return <FallbackHero />;
    return this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}

export default function Hero3D() {
  if (typeof window !== "undefined" && !hasWebGL()) return <FallbackHero />;

  return (
    <WebGLErrorBoundary>
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <Canvas
          camera={{ position: [0.5, 1.4, 7], fov: 38 }}
          dpr={[1, 2]}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMappingExposure = 1.05;
          }}
        >
          {/* Warm low ambient sets the bookish mood */}
          <ambientLight intensity={0.32} color="#fff2dc" />

          {/* Key light — warm spot from upper-front-right */}
          <spotLight
            position={[6, 9, 5]}
            angle={0.34}
            penumbra={0.9}
            intensity={3.6}
            color="#ffd9a8"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0005}
          />

          {/* Cool fill — back-left, sets the volume */}
          <pointLight position={[-5, 4, -3]} intensity={0.7} color="#85a8d8" />

          {/* Rim light — picks out the spine edges */}
          <directionalLight position={[-2, 5, -7]} intensity={0.9} color="#fff0d0" />

          {/* Warm uplight — deepens the leather */}
          <pointLight position={[3, -2, 4]} intensity={0.55} color="#d49a5e" />

          {/* Subtle hemisphere for general softness */}
          <hemisphereLight args={["#fff5e6", "#3a2a1c", 0.25]} />

          <Float rotationIntensity={0.35} floatIntensity={0.55} speed={1.1}>
            <BookStack />
          </Float>

          <ContactShadows
            position={[0, -2.4, 0]}
            opacity={0.65}
            scale={16}
            blur={3}
            far={5}
            resolution={512}
            color="#1a0e05"
          />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
