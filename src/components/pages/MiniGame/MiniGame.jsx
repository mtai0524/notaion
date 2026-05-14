import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useRef, useState, useEffect, useCallback, memo, Suspense } from "react";
import * as THREE from "three";
import "./MiniGame.scss";

/* ─── Game Constants ─────────────────────────────────────── */
const GRAVITY = -26;
const JUMP_V = 15;
const MOVE_SPEED = 7;
const FWD_SPEED_INIT = 9;
const CHAR_HW = 0.26;  // half-width
const CHAR_H = 1.65;
const CHAR_HD = 0.18;  // half-depth
const DEATH_Y = -10;
const SPAWN_Z = -42;
const DESPAWN_Z = 18;
const PLATFORM_COLORS = ["#00d4ff", "#b06fff", "#ff6ef7", "#6efff4", "#ffb86e"];

/* ─── Utility ────────────────────────────────────────────── */
const rand = (min, max) => Math.random() * (max - min) + min;
let _id = 0;
const uid = () => ++_id;

function makePlatform(z, prevX = 0) {
  const w = rand(2, 5);
  const maxShift = 2.5;
  const x = THREE.MathUtils.clamp(prevX + rand(-maxShift, maxShift), -4, 4);
  const y = rand(-0.5, 2.5);
  const color = PLATFORM_COLORS[Math.floor(Math.random() * PLATFORM_COLORS.length)];
  const moving = Math.random() < 0.25;
  return { id: uid(), x, y, z, w, h: 0.35, d: 2.6, color, moving, moveDir: 1, moveRange: rand(1.5, 3), moveBase: x };
}

/* ─── Robot Character ────────────────────────────────────── */
const Robot = memo(({ posRef, velRef, onGroundRef }) => {
  const group = useRef();
  const head = useRef();
  const lArm = useRef();
  const rArm = useRef();
  const lLeg = useRef();
  const rLeg = useRef();
  const chest = useRef();
  const t = useRef(0);

  useFrame((_, dt) => {
    if (!group.current) return;
    const [px, py] = posRef.current;
    const [vx, vy] = velRef.current;
    const moving = Math.abs(vx) > 0.5;
    const onGround = onGroundRef.current;

    group.current.position.set(px, py, 0);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -vx * 0.035, 0.18);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, onGround ? -0.1 : -0.18, 0.12);

    t.current += dt * (moving ? 10 : onGround ? 2.5 : 0);
    const sw = Math.sin(t.current) * (moving ? 0.6 : 0.06);

    if (lArm.current) lArm.current.rotation.x = sw;
    if (rArm.current) rArm.current.rotation.x = -sw;
    if (lLeg.current) lLeg.current.rotation.x = -sw * 1.15;
    if (rLeg.current) rLeg.current.rotation.x = sw * 1.15;
    if (head.current) {
      head.current.position.y = 0.7 + Math.sin(t.current * 0.5) * (moving ? 0.045 : 0.012);
    }

    const jumpStretch = onGround ? 1 : 1.16;
    const jumpSquash = onGround ? 1 : 0.87;
    group.current.scale.y = THREE.MathUtils.lerp(group.current.scale.y, jumpStretch, 0.14);
    group.current.scale.x = THREE.MathUtils.lerp(group.current.scale.x, jumpSquash, 0.14);

    if (chest.current) {
      chest.current.emissiveIntensity = 1.6 + Math.sin(t.current * 4) * 0.6;
    }
  });

  const bm = { metalness: 0.85, roughness: 0.15 };

  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.52, 0.58, 0.36]} />
        <meshStandardMaterial color="#dce8ff" emissive="#1a3070" emissiveIntensity={0.35} {...bm} />
      </mesh>
      {/* Chest plate */}
      <mesh position={[0, 0.3, 0.19]}>
        <boxGeometry args={[0.28, 0.28, 0.025]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1.8} metalness={0.5} roughness={0.2} />
      </mesh>
      {/* Chest orb */}
      <mesh position={[0, 0.3, 0.215]}>
        <sphereGeometry args={[0.062, 10, 10]} />
        <meshStandardMaterial ref={chest} color="#00fff0" emissive="#00fff0" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, 0.3, 0.35]} color="#00d4ff" intensity={1.4} distance={2.2} />

      {/* Head */}
      <group ref={head} position={[0, 0.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.44, 0.44, 0.41]} />
          <meshStandardMaterial color="#eef2ff" metalness={0.82} roughness={0.18} emissive="#1a2060" emissiveIntensity={0.22} />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.04, 0.21]}>
          <boxGeometry args={[0.32, 0.14, 0.01]} />
          <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={5} transparent opacity={0.9} />
        </mesh>
        {/* Eye glow light */}
        <pointLight position={[0, 0.04, 0.3]} color="#00ffff" intensity={0.9} distance={1.8} />
        {/* Ear ports */}
        <mesh position={[-0.24, 0.02, 0]}>
          <boxGeometry args={[0.04, 0.18, 0.14]} />
          <meshStandardMaterial color="#99aedd" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[0.24, 0.02, 0]}>
          <boxGeometry args={[0.04, 0.18, 0.14]} />
          <meshStandardMaterial color="#99aedd" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0.1, 0.3, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.26, 6]} />
          <meshStandardMaterial color="#b8ccff" metalness={0.95} roughness={0.05} />
        </mesh>
        <mesh position={[0.1, 0.445, 0]}>
          <sphereGeometry args={[0.044, 10, 10]} />
          <meshStandardMaterial color="#ff7aff" emissive="#ff7aff" emissiveIntensity={3.5} />
        </mesh>
        <pointLight position={[0.1, 0.45, 0]} color="#ff7aff" intensity={0.7} distance={1.2} />
      </group>

      {/* Left arm */}
      <group ref={lArm} position={[-0.375, 0.22, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.17, 0.44, 0.17]} />
          <meshStandardMaterial color="#ccd8f0" {...bm} />
        </mesh>
        <mesh position={[0, -0.47, 0]}>
          <boxGeometry args={[0.2, 0.16, 0.2]} />
          <meshStandardMaterial color="#8898d0" metalness={0.9} roughness={0.1} emissive="#202080" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rArm} position={[0.375, 0.22, 0]}>
        <mesh castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.17, 0.44, 0.17]} />
          <meshStandardMaterial color="#ccd8f0" {...bm} />
        </mesh>
        <mesh position={[0, -0.47, 0]}>
          <boxGeometry args={[0.2, 0.16, 0.2]} />
          <meshStandardMaterial color="#8898d0" metalness={0.9} roughness={0.1} emissive="#202080" emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* Left leg */}
      <group ref={lLeg} position={[-0.155, -0.14, 0]}>
        <mesh castShadow position={[0, -0.24, 0]}>
          <boxGeometry args={[0.19, 0.48, 0.2]} />
          <meshStandardMaterial color="#ccd8f0" {...bm} />
        </mesh>
        <mesh position={[0, -0.52, 0.06]}>
          <boxGeometry args={[0.23, 0.13, 0.32]} />
          <meshStandardMaterial color="#7888c0" metalness={0.92} roughness={0.12} emissive="#182060" emissiveIntensity={0.55} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={rLeg} position={[0.155, -0.14, 0]}>
        <mesh castShadow position={[0, -0.24, 0]}>
          <boxGeometry args={[0.19, 0.48, 0.2]} />
          <meshStandardMaterial color="#ccd8f0" {...bm} />
        </mesh>
        <mesh position={[0, -0.52, 0.06]}>
          <boxGeometry args={[0.23, 0.13, 0.32]} />
          <meshStandardMaterial color="#7888c0" metalness={0.92} roughness={0.12} emissive="#182060" emissiveIntensity={0.55} />
        </mesh>
      </group>
    </group>
  );
});
Robot.displayName = "Robot";

/* ─── Platform ───────────────────────────────────────────── */
const Platform = memo(({ plat }) => {
  const group = useRef();

  useFrame(() => {
    if (group.current) {
      group.current.position.set(plat.x, plat.y, plat.z);
    }
  });

  const { w, h, d, color } = plat;
  const edgeH = 0.04;
  const edgeW = 0.05;

  return (
    <group ref={group}>
      {/* Main body */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#0a0e1a" emissive={color} emissiveIntensity={0.12} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Top glow edge - front */}
      <mesh position={[0, h / 2 + edgeH / 2, d / 2]}>
        <boxGeometry args={[w, edgeH, edgeW]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.9} />
      </mesh>
      {/* Top glow edge - back */}
      <mesh position={[0, h / 2 + edgeH / 2, -d / 2]}>
        <boxGeometry args={[w, edgeH, edgeW]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.9} />
      </mesh>
      {/* Top glow edge - left */}
      <mesh position={[-w / 2, h / 2 + edgeH / 2, 0]}>
        <boxGeometry args={[edgeW, edgeH, d]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.9} />
      </mesh>
      {/* Top glow edge - right */}
      <mesh position={[w / 2, h / 2 + edgeH / 2, 0]}>
        <boxGeometry args={[edgeW, edgeH, d]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} transparent opacity={0.9} />
      </mesh>
      {/* Bottom glow */}
      <pointLight position={[0, -h / 2 - 0.3, 0]} color={color} intensity={0.8} distance={3.5} />
    </group>
  );
});
Platform.displayName = "Platform";

/* ─── Crystal ────────────────────────────────────────────── */
const Crystal = memo(({ crystal }) => {
  const group = useRef();
  const t = useRef(Math.random() * Math.PI * 2);

  useFrame((_, dt) => {
    if (!group.current) return;
    t.current += dt * 2.2;
    // Read from mutable crystal object so position follows scroll
    group.current.position.set(
      crystal.x,
      crystal.y + 0.4 + Math.sin(t.current) * 0.18,
      crystal.z
    );
    group.current.rotation.y += dt * 2.6;
    group.current.rotation.x += dt * 1.3;
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color="#ffe066"
          emissive="#ffcc00"
          emissiveIntensity={3}
          metalness={0.3}
          roughness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Light sits at group origin → moves with group */}
      <pointLight color="#ffcc00" intensity={1.4} distance={3.2} />
    </group>
  );
});
Crystal.displayName = "Crystal";

/* ─── Game Scene (all logic) ─────────────────────────────── */
function GameScene({ onScoreUpdate, onDie, speed }) {
  const { camera } = useThree();

  // Game state refs (mutable, no re-render)
  const posRef = useRef([0, 2, 0]);       // [x, y]
  const velRef = useRef([0, 0]);          // [vx, vy]
  const onGroundRef = useRef(false);
  const jumpQueueRef = useRef(false);
  const keysRef = useRef({});
  const platformsRef = useRef([]);
  const crystalsRef = useRef([]);
  const timeRef = useRef(0);
  const scoreRef = useRef(0);
  const lastScoreUpdateRef = useRef(0);
  const deadRef = useRef(false);
  const speedRef = useRef(speed);

  // React state for render triggers
  const [platforms, setPlatforms] = useState([]);
  const [crystals, setCrystals] = useState([]);
  const [, forceRender] = useState(0);

  // Sync speedRef when prop changes
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Keyboard
  useEffect(() => {
    const onDown = (e) => {
      keysRef.current[e.code] = true;
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && onGroundRef.current) {
        jumpQueueRef.current = true;
      }
    };
    const onUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // Touch controls
  useEffect(() => {
    const handleTouch = (e) => {
      const x = e.touches[0].clientX;
      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      const y = e.touches[0].clientY;
      if (y < midY) {
        jumpQueueRef.current = true;
      } else if (x < midX - 60) {
        keysRef.current["ArrowLeft"] = true;
      } else if (x > midX + 60) {
        keysRef.current["ArrowRight"] = true;
      }
    };
    const handleTouchEnd = () => {
      keysRef.current["ArrowLeft"] = false;
      keysRef.current["ArrowRight"] = false;
    };
    window.addEventListener("touchstart", handleTouch);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Init platforms
  useEffect(() => {
    // Starting safe platform
    const initPlats = [
      { id: uid(), x: 0, y: 0, z: -2, w: 6, h: 0.35, d: 4, color: "#00d4ff", moving: false, moveDir: 1, moveRange: 0, moveBase: 0 },
    ];
    let lastX = 0;
    for (let z = SPAWN_Z; z < -6; z += rand(4.5, 7)) {
      initPlats.push(makePlatform(z, lastX));
      lastX = initPlats[initPlats.length - 1].x;
    }
    platformsRef.current = initPlats;
    setPlatforms([...initPlats]);

    // Crystals on starting platform
    const initCrystals = [
      { id: uid(), x: -1.5, y: 0.35, z: -2 },
      { id: uid(), x: 0, y: 0.35, z: -2 },
      { id: uid(), x: 1.5, y: 0.35, z: -2 },
    ];
    crystalsRef.current = initCrystals;
    setCrystals([...initCrystals]);

    posRef.current = [0, 2, 0];
    velRef.current = [0, 0];
    onGroundRef.current = false;
    scoreRef.current = 0;
    deadRef.current = false;
    timeRef.current = 0;
  }, []);

  useFrame((_, dt) => {
    if (deadRef.current) return;
    dt = Math.min(dt, 0.05); // cap delta
    timeRef.current += dt;

    const spd = speedRef.current;
    const [px, py] = posRef.current;
    let [vx, vy] = velRef.current;
    const keys = keysRef.current;

    // ── Input ──────────────────────────────────────────────
    const left = keys["ArrowLeft"] || keys["KeyA"];
    const right = keys["ArrowRight"] || keys["KeyD"];
    vx = left ? -MOVE_SPEED : right ? MOVE_SPEED : vx * 0.7;

    // ── Jump ───────────────────────────────────────────────
    if (jumpQueueRef.current && onGroundRef.current) {
      vy = JUMP_V;
      onGroundRef.current = false;
      jumpQueueRef.current = false;
    }

    // ── Gravity ────────────────────────────────────────────
    if (!onGroundRef.current) {
      vy += GRAVITY * dt;
    }

    // ── Move ───────────────────────────────────────────────
    let nx = THREE.MathUtils.clamp(px + vx * dt, -5.5, 5.5);
    let ny = py + vy * dt;
    let landed = false;

    // ── Platform collision ─────────────────────────────────
    for (const p of platformsRef.current) {
      const pTop = p.y + p.h / 2;
      const pBot = p.y - p.h / 2;
      const pLeft = p.x - p.w / 2 - CHAR_HW;
      const pRight = p.x + p.w / 2 + CHAR_HW;
      const pFront = p.z + p.d / 2 + CHAR_HD;
      const pBack = p.z - p.d / 2 - CHAR_HD;

      if (nx > pLeft && nx < pRight && pBack < 0 && pFront > 0) {
        if (vy <= 0 && ny <= pTop && py >= pTop - 0.35) {
          ny = pTop;
          vy = 0;
          onGroundRef.current = true;
          landed = true;
          break;
        }
      }
    }
    if (!landed && vy < -1) onGroundRef.current = false;

    posRef.current = [nx, ny];
    velRef.current = [vx, vy];

    // ── Move platforms ──────────────────────────────────────
    let changed = false;
    for (const p of platformsRef.current) {
      p.z += spd * dt;
      if (p.moving) {
        p.x = p.moveBase + Math.sin(timeRef.current * 1.4) * p.moveRange;
      }
    }

    // ── Despawn old platforms ───────────────────────────────
    const before = platformsRef.current.length;
    platformsRef.current = platformsRef.current.filter((p) => p.z < DESPAWN_Z);
    if (platformsRef.current.length < before) changed = true;

    // ── Spawn new platform ──────────────────────────────────
    const lastZ = Math.min(...platformsRef.current.map((p) => p.z));
    if (lastZ > SPAWN_Z + rand(4.5, 7)) {
      const lastPlat = platformsRef.current.reduce((a, b) => (a.z < b.z ? a : b));
      const np = makePlatform(SPAWN_Z, lastPlat?.x ?? 0);
      platformsRef.current.push(np);
      changed = true;

      // Chance to add crystal
      if (Math.random() < 0.55) {
        const nc = { id: uid(), x: np.x + rand(-np.w / 3, np.w / 3), y: np.y + np.h / 2, z: np.z };
        crystalsRef.current.push(nc);
      }
    }

    // ── Move & collect crystals ─────────────────────────────
    for (const c of crystalsRef.current) {
      c.z += spd * dt;
    }
    const prevLen = crystalsRef.current.length;
    crystalsRef.current = crystalsRef.current.filter((c) => {
      if (c.z > DESPAWN_Z) return false;
      const dx = Math.abs(c.x - nx);
      const dy = Math.abs(c.y + 0.4 - ny);
      const dz = Math.abs(c.z);
      if (dx < 0.7 && dy < 1.2 && dz < 1) {
        scoreRef.current += 50;
        return false;
      }
      return true;
    });
    if (crystalsRef.current.length !== prevLen) changed = true;

    // ── Score (time) ────────────────────────────────────────
    scoreRef.current += dt * 8;
    if (timeRef.current - lastScoreUpdateRef.current > 0.25) {
      onScoreUpdate(Math.floor(scoreRef.current));
      lastScoreUpdateRef.current = timeRef.current;
      changed = true;
    }

    if (changed) {
      setPlatforms([...platformsRef.current]);
      setCrystals([...crystalsRef.current]);
      forceRender((n) => n + 1);
    }

    // ── Death ───────────────────────────────────────────────
    if (ny < DEATH_Y) {
      deadRef.current = true;
      onDie(Math.floor(scoreRef.current));
    }

    // ── Camera ─────────────────────────────────────────────
    const camTarget = new THREE.Vector3(nx * 0.4, ny + 4.5, 11);
    camera.position.lerp(camTarget, 0.08);
    camera.lookAt(nx * 0.2, ny + 0.8, 0);
  });

  return (
    <>
      <Robot posRef={posRef} velRef={velRef} onGroundRef={onGroundRef} />
      {platforms.map((p) => <Platform key={p.id} plat={p} />)}
      {crystals.map((c) => <Crystal key={c.id} crystal={c} />)}
    </>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function MiniGame() {
  const [phase, setPhase] = useState("start"); // start | playing | dead
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [hiScore, setHiScore] = useState(() => parseInt(localStorage.getItem("notaion_game_hi") || "0"));
  const [speed, setSpeed] = useState(FWD_SPEED_INIT);
  const [gameKey, setGameKey] = useState(0);

  const handleScore = useCallback((s) => {
    setScore(s);
    setSpeed(FWD_SPEED_INIT + Math.floor(s / 300) * 1.2);
  }, []);

  const handleDie = useCallback((s) => {
    setFinalScore(s);
    setPhase("dead");
    if (s > hiScore) {
      setHiScore(s);
      localStorage.setItem("notaion_game_hi", String(s));
    }
  }, [hiScore]);

  const restart = () => {
    setScore(0);
    setSpeed(FWD_SPEED_INIT);
    setGameKey((k) => k + 1);
    setPhase("playing");
  };

  return (
    <div className="mg-root">
      {/* Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 5, 11], fov: 65, near: 0.1, far: 400 }}
        gl={{ antialias: true }}
        style={{ background: "#030510" }}
      >
        <fog attach="fog" args={["#030510", 28, 80]} />

        {/* Lights */}
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[5, 12, 8]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          color="#aabaff"
        />
        <pointLight position={[-8, 6, 0]} color="#b06fff" intensity={1.2} distance={30} />
        <pointLight position={[8, 6, 0]} color="#00d4ff" intensity={1.2} distance={30} />

        {/* Stars */}
        <Suspense fallback={null}>
          <Stars radius={90} depth={50} count={5000} factor={5} saturation={0.8} fade speed={0.6} />
        </Suspense>

        {/* Game */}
        {phase === "playing" && (
          <GameScene
            key={gameKey}
            onScoreUpdate={handleScore}
            onDie={handleDie}
            speed={speed}
          />
        )}

        {/* Idle scene when not playing */}
        {phase !== "playing" && (
          <group>
            <mesh position={[0, -0.5, 0]} receiveShadow>
              <boxGeometry args={[8, 0.3, 5]} />
              <meshStandardMaterial color="#0a0e1a" emissive="#00d4ff" emissiveIntensity={0.15} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        )}
      </Canvas>

      {/* HUD */}
      {phase === "playing" && (
        <div className="mg-hud">
          <div className="mg-score">
            <span className="mg-score-label">SCORE</span>
            <span className="mg-score-val">{score.toLocaleString()}</span>
          </div>
          <div className="mg-hi">
            <span className="mg-score-label">BEST</span>
            <span className="mg-score-val mg-hi-val">{hiScore.toLocaleString()}</span>
          </div>
          <div className="mg-speed">
            <div className="mg-speed-bar" style={{ width: `${Math.min(100, ((speed - FWD_SPEED_INIT) / 12) * 100)}%` }} />
          </div>
          <div className="mg-controls-hint">
            <kbd>A</kbd><kbd>D</kbd> move &nbsp; <kbd>Space</kbd> jump
          </div>
        </div>
      )}

      {/* Start Screen */}
      {phase === "start" && (
        <div className="mg-overlay">
          <div className="mg-card">
            <div className="mg-game-title">
              <span className="mg-title-line1">NEON</span>
              <span className="mg-title-line2">RUNNER</span>
            </div>
            <p className="mg-subtitle">Jump between floating platforms · Collect crystals</p>
            <div className="mg-controls-grid">
              <div><kbd>A</kbd> / <kbd>←</kbd></div><div>Move left</div>
              <div><kbd>D</kbd> / <kbd>→</kbd></div><div>Move right</div>
              <div><kbd>Space</kbd></div><div>Jump</div>
            </div>
            {hiScore > 0 && <p className="mg-best-label">Best: <strong>{hiScore.toLocaleString()}</strong></p>}
            <button className="mg-btn mg-btn-primary" onClick={restart}>
              ▶ START GAME
            </button>
          </div>
        </div>
      )}

      {/* Game Over */}
      {phase === "dead" && (
        <div className="mg-overlay">
          <div className="mg-card mg-card-dead">
            <div className="mg-dead-title">GAME OVER</div>
            <div className="mg-dead-score">
              <span className="mg-dead-label">Score</span>
              <span className="mg-dead-val">{finalScore.toLocaleString()}</span>
            </div>
            {finalScore >= hiScore && finalScore > 0 && (
              <div className="mg-new-best">🏆 NEW BEST!</div>
            )}
            <div className="mg-dead-score">
              <span className="mg-dead-label">Best</span>
              <span className="mg-dead-val mg-dead-hi">{hiScore.toLocaleString()}</span>
            </div>
            <div className="mg-dead-btns">
              <button className="mg-btn mg-btn-primary" onClick={restart}>↺ PLAY AGAIN</button>
              <button className="mg-btn mg-btn-ghost" onClick={() => setPhase("start")}>✕ MENU</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
