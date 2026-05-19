import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Stars, ContactShadows, useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";

const CatModel = () => {
  const { scene } = useGLTF("/models/cat.glb");
  const ref = useRef(null);

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Re-tint with a stylized standard material to blend with scene lighting.
        const baseMap = obj.material?.map || null;
        obj.material = new THREE.MeshStandardMaterial({
          color: baseMap ? "#ffffff" : "#f4a261",
          map: baseMap,
          metalness: 0.15,
          roughness: 0.55,
          emissive: new THREE.Color("#6394f7"),
          emissiveIntensity: 0.06,
        });
      }
    });
  }, [scene]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });

  return (
    <group ref={ref}>
      <Center>
        <primitive object={scene} scale={2.2} />
      </Center>
    </group>
  );
};

useGLTF.preload("/models/cat.glb");

const LoginScene = () => {
  return (
    <div className="login-scene">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 1.2, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0b1020"]} />
        <fog attach="fog" args={["#0b1020", 8, 22]} />

        <ambientLight intensity={0.45} />
        <directionalLight
          position={[4, 6, 5]}
          intensity={1.1}
          color="#aabaff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight position={[-4, 2, 2]} color="#a78bfa" intensity={1.4} distance={20} />
        <pointLight position={[4, -1, 2]} color="#22d3ee" intensity={1.2} distance={20} />

        <Suspense fallback={null}>
          <Stars radius={50} depth={30} count={1200} factor={3} saturation={0.6} fade speed={0.5} />
          <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.8}>
            <CatModel />
          </Float>
          <Sparkles count={60} scale={6} size={2.5} speed={0.4} color="#7dd3fc" />
          <ContactShadows position={[0, -1.6, 0]} opacity={0.55} scale={8} blur={2.4} far={4} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default LoginScene;
