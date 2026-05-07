"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import axios from "axios";
import * as THREE from "three";

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Derives a clean username from an email address */
function deriveUsername(email: string): string {
    const local = email.split("@")[0] ?? "";
    // keep only alphanumeric + underscores, collapse runs, strip leading/trailing _
    return local
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 24);
}

// ─── Canvas / Shader boilerplate (identical to sign-in) ──────────────────────

type Uniforms = { [k: string]: { value: number | number[] | number[][]; type: string } };

const ShaderMesh = ({ source, uniforms }: { source: string; uniforms: Uniforms }) => {
    const { size } = useThree();
    const ref = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (ref.current) (ref.current.material as any).uniforms.u_time.value = clock.getElapsedTime();
    });

    const buildUniforms = () => {
        const out: any = {};
        for (const k in uniforms) {
            const u: any = uniforms[k];
            if (u.type === "uniform3fv") out[k] = { value: (u.value as number[][]).map((v: number[]) => new THREE.Vector3().fromArray(v)) };
            else out[k] = { value: u.value };
        }
        out.u_time = { value: 0 };
        out.u_resolution = { value: new THREE.Vector2(size.width * 2, size.height * 2) };
        return out;
    };

    const mat = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: `precision mediump float; uniform vec2 u_resolution; out vec2 fragCoord;
      void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
        fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
        fragCoord.y = u_resolution.y - fragCoord.y;
      }`,
        fragmentShader: source,
        uniforms: buildUniforms(),
        glslVersion: THREE.GLSL3,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
    }), [size.width, size.height, source]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <mesh ref={ref as any}>
            <planeGeometry args={[2, 2]} />
            <primitive object={mat} attach="material" />
        </mesh>
    );
};

const DotCanvas = ({ reverse = false }: { reverse?: boolean }) => {
    const uniforms = useMemo(() => ({
        u_colors: { value: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], type: "uniform3fv" },
        u_opacities: { value: [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1], type: "uniform1fv" },
        u_total_size: { value: 20, type: "uniform1f" },
        u_dot_size: { value: 6, type: "uniform1f" },
        u_reverse: { value: reverse ? 1 : 0, type: "uniform1i" },
    }), [reverse]);

    const FRAG = `
    precision mediump float;
    in vec2 fragCoord;
    uniform float u_time, u_total_size, u_dot_size;
    uniform float u_opacities[10];
    uniform vec3 u_colors[6];
    uniform vec2 u_resolution;
    uniform int u_reverse;
    out vec4 fragColor;
    float PHI = 1.61803398874989484820459;
    float random(vec2 xy) { return fract(tan(distance(xy*PHI,xy)*0.5)*xy.x); }
    void main() {
      vec2 st = fragCoord.xy;
      st.x -= abs(floor((mod(u_resolution.x,u_total_size)-u_dot_size)*0.5));
      st.y -= abs(floor((mod(u_resolution.y,u_total_size)-u_dot_size)*0.5));
      float op = step(0.0,st.x)*step(0.0,st.y);
      vec2 st2 = vec2(int(st.x/u_total_size),int(st.y/u_total_size));
      float show_off = random(st2);
      float rand = random(st2*floor((u_time/5.0)+show_off+5.0));
      op *= u_opacities[int(rand*10.0)];
      op *= 1.0-step(u_dot_size/u_total_size,fract(st.x/u_total_size));
      op *= 1.0-step(u_dot_size/u_total_size,fract(st.y/u_total_size));
      vec3 color = u_colors[int(show_off*6.0)];
      vec2 cg = u_resolution/2.0/u_total_size;
      float dist = distance(cg,st2);
      float mdist = distance(cg,vec2(0.0));
      if (u_reverse==1) {
        float off=(mdist-dist)*0.02+random(st2+42.0)*0.2;
        op *= 1.0-step(off,u_time*0.5);
        op *= clamp(step(off+0.1,u_time*0.5)*1.25,1.0,1.25);
      } else {
        float off=dist*0.01+random(st2)*0.15;
        op *= step(off,u_time*0.5);
        op *= clamp((1.0-step(off+0.1,u_time*0.5))*1.25,1.0,1.25);
      }
      fragColor = vec4(color,op);
      fragColor.rgb *= fragColor.a;
    }`;

    return (
        <Canvas className="absolute inset-0 h-full w-full">
            <ShaderMesh source={FRAG} uniforms={uniforms} />
        </Canvas>
    );
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

// ─── Sign-Up Page ─────────────────────────────────────────────────────────────

export default function SignUpPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGitHubLoading, setIsGitHubLoading] = useState(false);
    const [step, setStep] = useState<"form" | "success">("form");

    // canvas reveal state
    const [showInitial, setShowInitial] = useState(true);
    const [showReverse, setShowReverse] = useState(false);

    // Auto-generate username whenever email changes
    useEffect(() => {
        setUsername(deriveUsername(email));
    }, [email]);

    // ── GitHub OAuth ─────────────────────────────────────────────────────────────
    const handleGitHub = async () => {
        setIsGitHubLoading(true);
        setError(null);
        await signIn("github", { callbackUrl: "/dashboard" });
    };

    // ── Email + Password Sign-Up ──────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await axios.post("/api/auth/signup", { email, password, name, username });
            // Trigger success animation, then redirect to sign-in
            setShowReverse(true);
            setTimeout(() => setShowInitial(false), 50);
            setTimeout(() => {
                setStep("success");
                setTimeout(() => router.push("/signin"), 1500);
            }, 1800);
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Failed to create account. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0F172A] relative">
            {/* ── Animated Background ─────────────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                {showInitial && (
                    <div className="absolute inset-0">
                        <DotCanvas reverse={false} />
                    </div>
                )}
                {showReverse && (
                    <div className="absolute inset-0">
                        <DotCanvas reverse={true} />
                    </div>
                )}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.88)_0%,_transparent_100%)]" />
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
            </div>

            {/* ── Content ─────────────────────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4 py-16">
                <div className="w-full max-w-sm">
                    <AnimatePresence mode="wait">
                        {step === "form" ? (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0, y: 24 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="space-y-6"
                            >
                                {/* Heading */}
                                <div className="text-center space-y-1">
                                    <h1 className="text-4xl font-bold tracking-tight text-white">Create account</h1>
                                    <p className="text-white/50 text-base font-light">Join OptiFlow today</p>
                                </div>

                                {/* GitHub Button */}
                                <button
                                    onClick={handleGitHub}
                                    disabled={isGitHubLoading || isLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10
                             text-white border border-white/15 rounded-xl py-3 px-4
                             transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                             hover:border-white/30 active:scale-[0.98] text-sm font-medium"
                                >
                                    {isGitHubLoading ? (
                                        <Spinner />
                                    ) : (
                                        <GitHubIcon />
                                    )}
                                    Continue with GitHub
                                </button>

                                {/* Divider */}
                                <div className="flex items-center gap-4">
                                    <div className="h-px bg-white/10 flex-1" />
                                    <span className="text-white/30 text-xs uppercase tracking-wider">or</span>
                                    <div className="h-px bg-white/10 flex-1" />
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} className="space-y-3">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center"
                                        >
                                            {error}
                                        </motion.div>
                                    )}

                                    {/* Full Name */}
                                    <input
                                        type="text"
                                        placeholder="Full name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoComplete="name"
                                        className={inputCls}
                                    />

                                    {/* Email */}
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className={inputCls}
                                    />

                                    {/* Username — auto-derived, still editable */}
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm select-none pointer-events-none">
                                            @
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                            maxLength={24}
                                            className={cn(inputCls, "pl-8")}
                                        />
                                    </div>
                                    <p className="text-[11px] text-white/25 -mt-1 pl-1">
                                        Auto-generated from your email — you can change it
                                    </p>

                                    {/* Password */}
                                    <input
                                        type="password"
                                        placeholder="Password (min. 6 characters)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                        className={inputCls}
                                    />

                                    <motion.button
                                        type="submit"
                                        disabled={isLoading || isGitHubLoading || !email || !password}
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white
                               text-black font-semibold py-3 text-sm
                               hover:bg-white/90 transition-all duration-200
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {isLoading ? <Spinner dark /> : "Create Account"}
                                    </motion.button>
                                </form>

                                {/* Footer */}
                                <p className="text-center text-sm text-white/40">
                                    Already have an account?{" "}
                                    <Link href="/signin" className="text-white/70 hover:text-white transition-colors underline underline-offset-4">
                                        Sign in
                                    </Link>
                                </p>

                                <p className="text-xs text-white/20 text-center leading-relaxed">
                                    By creating an account you agree to our{" "}
                                    <Link href="#" className="underline hover:text-white/40 transition-colors">Terms</Link>
                                    {" "}and{" "}
                                    <Link href="#" className="underline hover:text-white/40 transition-colors">Privacy Policy</Link>.
                                </p>
                            </motion.div>
                        ) : (
                            /* ── Success ──────────────────────────────────────────────── */
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="space-y-6 text-center"
                            >
                                <div className="space-y-1">
                                    <h1 className="text-4xl font-bold tracking-tight text-white">Account created!</h1>
                                    <p className="text-white/50 text-lg font-light">Taking you to sign in…</p>
                                </div>
                                <motion.div
                                    initial={{ scale: 0.7, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="py-8"
                                >
                                    <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/70 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-black" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputCls =
    "w-full bg-white/5 text-white placeholder-white/30 border border-white/10 " +
    "rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-white/30 " +
    "focus:bg-white/8 transition-all duration-200";

const Spinner = ({ dark = false }: { dark?: boolean }) => (
    <svg
        className={cn("animate-spin w-4 h-4", dark ? "text-black" : "text-white")}
        viewBox="0 0 24 24"
        fill="none"
    >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
);
