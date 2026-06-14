import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";

/** Drifting, blurred radial-gradient blobs behind the hero/auth surfaces. */
export function GlowBackground({ subtle = false }: { subtle?: boolean }) {
  const reduce = useReducedMotion();
  const opacity = subtle ? 0.5 : 1;

  const blob = (className: string, anim: TargetAndTransition) => (
    <motion.div
      className={`absolute rounded-full blur-[100px] ${className}`}
      animate={reduce ? undefined : anim}
      transition={{ duration: 18, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ opacity }}
      aria-hidden
    >
      {blob(
        "left-1/4 top-1/4 h-[34rem] w-[34rem] bg-[hsl(var(--glow)/0.30)]",
        { x: [0, 60, -20, 0], y: [0, -40, 30, 0], scale: [1, 1.1, 0.95, 1] }
      )}
      {blob(
        "right-1/4 top-1/3 h-[28rem] w-[28rem] bg-[hsl(var(--glow-2)/0.28)]",
        { x: [0, -50, 30, 0], y: [0, 40, -20, 0], scale: [1, 0.95, 1.1, 1] }
      )}
      {blob(
        "bottom-0 left-1/2 h-[24rem] w-[24rem] bg-[hsl(var(--glow)/0.20)]",
        { x: [0, 30, -40, 0], y: [0, -20, 20, 0] }
      )}
    </div>
  );
}
