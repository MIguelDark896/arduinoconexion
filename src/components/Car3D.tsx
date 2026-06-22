import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  ContactShadows,
  Environment,
  Float,
} from "@react-three/drei";
import * as THREE from "three";

const LCD_GREEN = "#86ff9f";
const BODY_COLOR = "#1ea7c7";
const ACCENT_COLOR = "#ff3fae";

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.32, 28]} />
        <meshStandardMaterial color="#0c0f14" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 20]} />
        <meshStandardMaterial
          color={LCD_GREEN}
          emissive={LCD_GREEN}
          emissiveIntensity={0.6}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function LedScreen({ word }: { word: string }) {
  const text = (word || "HOLA").toUpperCase().slice(0, 16);
  return (
    <group position={[0, 1.15, 0]}>
      {/* screen housing */}
      <mesh castShadow>
        <boxGeometry args={[2.2, 0.62, 0.42]} />
        <meshStandardMaterial color="#0a0d12" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* glowing green panel */}
      <mesh position={[0, 0, 0.215]}>
        <planeGeometry args={[2.0, 0.46]} />
        <meshStandardMaterial
          color="#0c3b1c"
          emissive={LCD_GREEN}
          emissiveIntensity={0.45}
        />
      </mesh>
      <Text
        position={[0, 0, 0.23]}
        fontSize={text.length > 9 ? 0.2 : 0.28}
        maxWidth={1.9}
        color={LCD_GREEN}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        outlineWidth={0.004}
        outlineColor={LCD_GREEN}
      >
        {text}
      </Text>
    </group>
  );
}

function Sparks({ active }: { active: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 120;
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = Math.random() * 1.2;
      positions[i * 3 + 2] = 2 + Math.random() * 0.5;
      velocities.push(
        (Math.random() - 0.5) * 0.06,
        Math.random() * 0.04,
        0.12 + Math.random() * 0.18,
      );
    }
    return { positions, velocities };
  }, []);

  useFrame(() => {
    if (!ref.current || !active) return;
    const pos = ref.current.geometry.attributes.position
      .array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3] += data.velocities[i * 3];
      pos[i * 3 + 1] += data.velocities[i * 3 + 1];
      pos[i * 3 + 2] += data.velocities[i * 3 + 2];
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={ACCENT_COLOR}
        size={0.12}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CarModel({
  word,
  launching,
  onLaunchComplete,
}: {
  word: string;
  launching: boolean;
  onLaunchComplete: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const [gone, setGone] = useState(false);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    if (launching && !gone) {
      progress.current = Math.min(progress.current + delta * 0.55, 1);
      const p = progress.current;
      // accelerate away from camera
      g.position.z = -p * p * 26;
      g.position.y = p * 1.2;
      g.rotation.y = p * 0.4;
      const s = 1 - p * 0.5;
      g.scale.setScalar(Math.max(s, 0.0001));
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && "opacity" in m) {
          (m as THREE.Material & { transparent: boolean }).transparent = true;
          (m as { opacity: number }).opacity = 1 - p;
        }
      });
      if (p >= 1) {
        setGone(true);
        onLaunchComplete();
      }
    } else if (!launching && !gone) {
      // idle hover wheels spin slight
      g.position.z = THREE.MathUtils.lerp(g.position.z, 0, 0.1);
    }
  });

  if (gone) return null;

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0} floatIntensity={launching ? 0 : 0.4}>
        {/* main body */}
        <mesh castShadow position={[0, 0.45, 0]}>
          <boxGeometry args={[2.6, 0.7, 1.4]} />
          <meshStandardMaterial
            color={BODY_COLOR}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        {/* lower skirt */}
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[2.7, 0.25, 1.5]} />
          <meshStandardMaterial color="#0c0f14" metalness={0.5} roughness={0.4} />
        </mesh>
        {/* cabin */}
        <mesh castShadow position={[-0.1, 0.95, 0]}>
          <boxGeometry args={[1.5, 0.55, 1.2]} />
          <meshStandardMaterial
            color="#0d1620"
            metalness={0.4}
            roughness={0.2}
          />
        </mesh>
        {/* windshield glow strip */}
        <mesh position={[0.66, 0.95, 0]}>
          <boxGeometry args={[0.05, 0.4, 1.1]} />
          <meshStandardMaterial
            color={ACCENT_COLOR}
            emissive={ACCENT_COLOR}
            emissiveIntensity={0.8}
          />
        </mesh>
        {/* headlights */}
        <mesh position={[1.32, 0.45, 0.45]}>
          <boxGeometry args={[0.08, 0.18, 0.3]} />
          <meshStandardMaterial
            color="#fff"
            emissive="#bff"
            emissiveIntensity={1.2}
          />
        </mesh>
        <mesh position={[1.32, 0.45, -0.45]}>
          <boxGeometry args={[0.08, 0.18, 0.3]} />
          <meshStandardMaterial
            color="#fff"
            emissive="#bff"
            emissiveIntensity={1.2}
          />
        </mesh>
        {/* taillights */}
        <mesh position={[-1.32, 0.5, 0]}>
          <boxGeometry args={[0.06, 0.16, 1.0]} />
          <meshStandardMaterial
            color={ACCENT_COLOR}
            emissive={ACCENT_COLOR}
            emissiveIntensity={1.4}
          />
        </mesh>

        <Wheel position={[0.85, 0.35, 0.72]} />
        <Wheel position={[0.85, 0.35, -0.72]} />
        <Wheel position={[-0.85, 0.35, 0.72]} />
        <Wheel position={[-0.85, 0.35, -0.72]} />

        <LedScreen word={word} />
      </Float>
      <Sparks active={launching} />
    </group>
  );
}

export default function Car3D({
  word,
  launching,
  onLaunchComplete,
}: {
  word: string;
  launching: boolean;
  onLaunchComplete: () => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4.5, 2.6, 5.5], fov: 42 }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, -4]} intensity={40} color={ACCENT_COLOR} />
      <pointLight position={[5, 2, 4]} intensity={25} color={LCD_GREEN} />

      <CarModel
        word={word}
        launching={launching}
        onLaunchComplete={onLaunchComplete}
      />

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.55}
        scale={12}
        blur={2.4}
        far={5}
      />
      <Environment preset="night" />
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={11}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={!launching}
        autoRotateSpeed={0.8}
      />
    </Canvas>
  );
}
