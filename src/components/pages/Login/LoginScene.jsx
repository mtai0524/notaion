import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Stars, ContactShadows } from "@react-three/drei";

const FloatingCrystal = () => {
  const groupRef = useRef(null);
  const innerRef = useRef(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
    if (innerRef.current) {
      innerRef.current.rotation.x -= delta * 0.5;
      innerRef.current.rotation.z += delta * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer wireframe shell */}
      <mesh>
        <icosahedronGeometry args={[1.55, 1]} />
        <meshBasicMaterial color="#7dd3fc" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Inner glowing crystal */}
      <mesh ref={innerRef} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#6394f7"
          emissive="#6394f7"
          emissiveIntensity={0.6}
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>

      {/* Orbiting accent rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.025, 16, 100]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[0, Math.PI / 3, Math.PI / 4]}>
        <torusGeometry args={[2.3, 0.02, 16, 100]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.45} />
      </mesh>
    </group>
  );
};

const LoginScene = () => {
  return (
    <div className="login-scene">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0.5, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0b1020"]} />
        <fog attach="fog" args={["#0b1020", 8, 22]} />

        <ambientLight intensity={0.35} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={1.1}
          color="#aabaff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-4, 2, 2]} color="#a78bfa" intensity={1.4} distance={20} />
        <pointLight position={[4, -2, 2]} color="#22d3ee" intensity={1.2} distance={20} />

        <Suspense fallback={null}>
          <Stars radius={50} depth={30} count={1200} factor={3} saturation={0.6} fade speed={0.5} />
          <Float speed={2.2} rotationIntensity={0.6} floatIntensity={1.2}>
            <FloatingCrystal />
          </Float>
          <Sparkles count={60} scale={6} size={2.5} speed={0.4} color="#7dd3fc" />
          <ContactShadows position={[0, -1.8, 0]} opacity={0.5} scale={8} blur={2.4} far={4} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default LoginScene;
