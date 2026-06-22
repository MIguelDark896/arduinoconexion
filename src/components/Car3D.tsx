import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  ContactShadows,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";

const LCD_BLUE = "#1e3aff";
const LCD_TEXT = "#d6e0ff";
const RAIL_BLUE = "#1f6dff";
const DECK_TAN = "#d8c89a";
const TRACK_DARK = "#2a2d33";
const WHEEL_ORANGE = "#e8631b";
const ACCENT_COLOR = "#ff7a1a";

export type MotorState = "stop" | "forward" | "backward";

/* ---------- One continuous tank track (left or right) ---------- */
function Track({
  side,
  speedRef,
}: {
  side: 1 | -1;
  speedRef: React.MutableRefObject<number>;
}) {
  const treadsRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);
  const z = side * 0.95;

  // tread segments wrapped around an oval path
  const segments = useMemo(() => {
    const n = 30;
    const arr: { x: number; y: number; rot: number }[] = [];
    const halfLen = 1.55;
    const radius = 0.42;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      // simple stadium (oval) path: top run, front cap, bottom run, back cap
      let x = 0;
      let y = 0;
      let rot = 0;
      const perim = t;
      if (perim < 0.4) {
        // top straight (front -> back)
        const k = perim / 0.4;
        x = halfLen - k * halfLen * 2;
        y = radius;
        rot = 0;
      } else if (perim < 0.5) {
        // back cap
        const a = ((perim - 0.4) / 0.1) * Math.PI;
        x = -halfLen - Math.sin(a) * radius;
        y = Math.cos(a) * radius;
        rot = a;
      } else if (perim < 0.9) {
        // bottom straight (back -> front)
        const k = (perim - 0.5) / 0.4;
        x = -halfLen + k * halfLen * 2;
        y = -radius;
        rot = Math.PI;
      } else {
        // front cap
        const a = ((perim - 0.9) / 0.1) * Math.PI;
        x = halfLen + Math.sin(a) * radius;
        y = -Math.cos(a) * radius;
        rot = Math.PI + a;
      }
      arr.push({ x, y, rot });
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const s = speedRef.current;
    if (treadsRef.current) {
      // shift treads along their length to fake rolling
      treadsRef.current.children.forEach((c) => {
        c.position.x -= s * delta * 4;
        if (c.position.x < -1.7) c.position.x += 3.4;
        if (c.position.x > 1.7) c.position.x -= 3.4;
      });
    }
    wheelRefs.current.forEach((w) => {
      if (w) w.rotation.z -= s * delta * 6;
    });
  });

  const wheelX = [-1.25, -0.42, 0.42, 1.25];

  return (
    <group position={[0, 0.5, z]}>
      {/* track frame plate */}
      <mesh>
        <boxGeometry args={[3.5, 0.95, 0.42]} />
        <meshStandardMaterial color={TRACK_DARK} roughness={0.85} metalness={0.2} />
      </mesh>
      {/* moving treads */}
      <group ref={treadsRef}>
        {segments.map((seg, i) => (
          <mesh
            key={i}
            position={[seg.x, seg.y, 0]}
            rotation={[0, 0, seg.rot]}
          >
            <boxGeometry args={[0.16, 0.1, 0.5]} />
            <meshStandardMaterial color="#15171b" roughness={0.95} />
          </mesh>
        ))}
      </group>
      {/* orange drive/idler wheels */}
      {wheelX.map((wx, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) wheelRefs.current[i] = el;
          }}
          position={[wx, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry
            args={i === 0 || i === 3 ? [0.34, 0.34, 0.34, 24] : [0.26, 0.26, 0.3, 20]}
            
          />
          <meshStandardMaterial
            color={WHEEL_ORANGE}
            roughness={0.45}
            metalness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- I2C LCD 16x2 screen (QAPASS style) mounted on deck ---------- */
function LcdScreen({ word }: { word: string }) {
  const text = (word || "HOLA").toUpperCase().slice(0, 16);
  const top = text.slice(0, 16);
  return (
    <group position={[0, 1.18, 0]} rotation={[-0.32, 0, 0]}>
      {/* green PCB */}
      <mesh castShadow>
        <boxGeometry args={[2.1, 0.95, 0.12]} />
        <meshStandardMaterial color="#0f7a2e" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* black bezel */}
      <mesh position={[0, 0.05, 0.07]}>
        <boxGeometry args={[1.8, 0.62, 0.06]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} />
      </mesh>
      {/* blue glowing LCD area */}
      <mesh position={[0, 0.05, 0.105]}>
        <planeGeometry args={[1.62, 0.46]} />
        <meshStandardMaterial
          color={LCD_BLUE}
          emissive={LCD_BLUE}
          emissiveIntensity={0.85}
        />
      </mesh>
      <Text
        position={[0, 0.05, 0.12]}
        fontSize={top.length > 9 ? 0.16 : 0.2}
        maxWidth={1.55}
        color={LCD_TEXT}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {top}
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
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = Math.random() * 1.2;
      positions[i * 3 + 2] = 2.5 + Math.random() * 0.5;
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
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
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
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
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

function TankModel({
  word,
  launching,
  motor,
  onLaunchComplete,
}: {
  word: string;
  launching: boolean;
  motor: MotorState;
  onLaunchComplete: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const [gone, setGone] = useState(false);
  // track speed: negative = backward, positive = forward
  const speedRef = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    // target track speed from motor state (or full speed when launching)
    let target = 0;
    if (launching) target = 1.6;
    else if (motor === "forward") target = 1;
    else if (motor === "backward") target = -1;
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, target, 0.1);

    if (launching && !gone) {
      progress.current = Math.min(progress.current + delta * 0.5, 1);
      const p = progress.current;
      g.position.z = -p * p * 26;
      g.position.y = p * 1.0;
      g.rotation.y = p * 0.3;
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
      g.position.z = THREE.MathUtils.lerp(g.position.z, 0, 0.1);
      // small rock when driving
      const rock = motor === "stop" ? 0 : Math.sin(performance.now() * 0.02) * 0.012;
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, rock, 0.2);
    }
  });

  if (gone) return null;

  return (
    <group ref={group}>
      {/* two tracks */}
      <Track side={1} speedRef={speedRef} />
      <Track side={-1} speedRef={speedRef} />

      {/* blue side rails */}
      <mesh position={[0, 0.95, 0.62]}>
        <boxGeometry args={[3.2, 0.12, 0.12]} />
        <meshStandardMaterial color={RAIL_BLUE} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.95, -0.62]}>
        <boxGeometry args={[3.2, 0.12, 0.12]} />
        <meshStandardMaterial color={RAIL_BLUE} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* front white axle bar */}
      <mesh position={[1.55, 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.5, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.4} />
      </mesh>

      {/* tan breadboard deck */}
      <mesh castShadow position={[0, 0.78, 0]}>
        <boxGeometry args={[2.7, 0.12, 1.05]} />
        <meshStandardMaterial color={DECK_TAN} roughness={0.85} />
      </mesh>

      {/* gray gearbox / motor block at the back */}
      <mesh castShadow position={[-1.0, 1.05, 0]}>
        <boxGeometry args={[0.85, 0.6, 0.95]} />
        <meshStandardMaterial color="#5a5e66" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* motor caps */}
      <mesh position={[-1.0, 1.1, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.25, 20]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-1.0, 1.1, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.25, 20]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* LCD screen mounted on the deck */}
      <LcdScreen word={word} />

      <Sparks active={launching} />
    </group>
  );
}

export default function Car3D({
  word,
  launching,
  motor = "stop",
  onLaunchComplete,
}: {
  word: string;
  launching: boolean;
  motor?: MotorState;
  onLaunchComplete: () => void;
}) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [4.8, 3, 5.8], fov: 42 }}>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 3, -4]} intensity={30} color={ACCENT_COLOR} />
      <pointLight position={[5, 2, 4]} intensity={25} color={LCD_BLUE} />

      <TankModel
        word={word}
        launching={launching}
        motor={motor}
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
        maxDistance={12}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={!launching && motor === "stop"}
        autoRotateSpeed={0.7}
      />
    </Canvas>
  );
}
