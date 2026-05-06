import { useRef, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function Book({
  position,
  rotation,
  color,
  scale,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  scale: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0.1, 0, 0]}>
        <boxGeometry args={[1.8, 0.3, 1.4]} />
        <meshStandardMaterial color="#f4ecd8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 0.4, 1.5]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0.1, 0, 0.71]}>
        <boxGeometry args={[1.7, 0.28, 0.01]} />
        <meshStandardMaterial color="#dcd0b8" roughness={1} />
      </mesh>
    </group>
  );
}

function BookStack() {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.4;
      group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });
  return (
    <group ref={group}>
      <Book position={[0, -0.7, 0]} rotation={[0, 0.1, 0]} color="#1a2e20" scale={1.2} />
      <Book position={[0, -0.1, 0]} rotation={[0, -0.15, 0]} color="#4a1c1c" scale={1.1} />
      <Book position={[0, 0.4, 0]} rotation={[0, 0.08, 0]} color="#8b6b45" scale={1.05} />
      <Book position={[0, 0.85, 0]} rotation={[0, -0.05, 0]} color="#2a2a2a" scale={0.95} />
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
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return <FallbackHero />;
    return this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export default function Hero3D() {
  if (typeof window !== "undefined" && !hasWebGL()) {
    return <FallbackHero />;
  }
  return (
    <WebGLErrorBoundary>
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <Canvas
          camera={{ position: [0, 1.5, 7], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.5} />
          <spotLight position={[5, 8, 5]} angle={0.2} penumbra={1} intensity={2} color="#ffe5b4" castShadow />
          <pointLight position={[-5, 5, -5]} intensity={0.8} color="#aaccff" />
          <Float rotationIntensity={0.4} floatIntensity={0.6} speed={1.2}>
            <BookStack />
          </Float>
          <ContactShadows position={[0, -1.8, 0]} opacity={0.6} scale={15} blur={2.5} far={4} resolution={256} color="#000000" />
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
