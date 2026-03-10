"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

type Uniforms = {
    [key: string]: {
        value: number[] | number[][] | number;
        type: string;
    };
};

interface ShaderProps {
    source: string;
    uniforms: Uniforms;
    maxFps?: number;
}

interface SignInPageProps {
    className?: string;
}

// ─── Canvas Reveal Effect ─────────────────────────────────────────────────────

export const CanvasRevealEffect = ({
    animationSpeed = 10,
    opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
    colors = [[0, 255, 255]],
    containerClassName,
    dotSize,
    showGradient = true,
    reverse = false,
}: {
    animationSpeed?: number;
    opacities?: number[];
    colors?: number[][];
    containerClassName?: string;
    dotSize?: number;
    showGradient?: boolean;
    reverse?: boolean;
}) => (
    <div className={cn("h-full relative w-full", containerClassName)}>
        <div className="h-full w-full">
            <DotMatrix
                colors={colors ?? [[0, 255, 255]]}
                dotSize={dotSize ?? 3}
                opacities={opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]}
                shader={`
          ${reverse ? "u_reverse_active" : "false"}_;
          animation_speed_factor_${animationSpeed.toFixed(1)}_;
        `}
                center={["x", "y"]}
            />
        </div>
        {showGradient && (
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        )}
    </div>
);

// ─── DotMatrix ────────────────────────────────────────────────────────────────

interface DotMatrixProps {
    colors?: number[][];
    opacities?: number[];
    totalSize?: number;
    dotSize?: number;
    shader?: string;
    center?: ("x" | "y")[];
}

const DotMatrix: React.FC<DotMatrixProps> = ({
    colors = [[0, 0, 0]],
    opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
    totalSize = 20,
    dotSize = 2,
    shader = "",
    center = ["x", "y"],
}) => {
    const uniforms = React.useMemo(() => {
        let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
        if (colors.length === 2) colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
        else if (colors.length === 3) colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
        return {
            u_colors: {
                value: colorsArray.map((c) => [c[0] / 255, c[1] / 255, c[2] / 255]),
                type: "uniform3fv",
            },
            u_opacities: { value: opacities, type: "uniform1fv" },
            u_total_size: { value: totalSize, type: "uniform1f" },
            u_dot_size: { value: dotSize, type: "uniform1f" },
            u_reverse: { value: shader.includes("u_reverse_active") ? 1 : 0, type: "uniform1i" },
        };
    }, [colors, opacities, totalSize, dotSize, shader]);

    return (
        <Shader
            source={`
        precision mediump float;
        in vec2 fragCoord;
        uniform float u_time;
        uniform float u_opacities[10];
        uniform vec3 u_colors[6];
        uniform float u_total_size;
        uniform float u_dot_size;
        uniform vec2 u_resolution;
        uniform int u_reverse;
        out vec4 fragColor;

        float PHI = 1.61803398874989484820459;
        float random(vec2 xy) { return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x); }

        void main() {
          vec2 st = fragCoord.xy;
          ${center.includes("x") ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));" : ""}
          ${center.includes("y") ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));" : ""}

          float opacity = step(0.0, st.x) * step(0.0, st.y);
          vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));
          float show_offset = random(st2);
          float rand = random(st2 * floor((u_time / 5.0) + show_offset + 5.0));
          opacity *= u_opacities[int(rand * 10.0)];
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
          opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

          vec3 color = u_colors[int(show_offset * 6.0)];
          vec2 center_grid = u_resolution / 2.0 / u_total_size;
          float dist = distance(center_grid, st2);
          float max_dist = distance(center_grid, vec2(0.0));

          if (u_reverse == 1) {
            float off = (max_dist - dist) * 0.02 + random(st2 + 42.0) * 0.2;
            opacity *= 1.0 - step(off, u_time * 0.5);
            opacity *= clamp(step(off + 0.1, u_time * 0.5) * 1.25, 1.0, 1.25);
          } else {
            float off = dist * 0.01 + random(st2) * 0.15;
            opacity *= step(off, u_time * 0.5);
            opacity *= clamp((1.0 - step(off + 0.1, u_time * 0.5)) * 1.25, 1.0, 1.25);
          }

          fragColor = vec4(color, opacity);
          fragColor.rgb *= fragColor.a;
        }`}
            uniforms={uniforms}
            maxFps={60}
        />
    );
};

// ─── ShaderMaterial / Shader ──────────────────────────────────────────────────

const ShaderMaterialComponent = ({ source, uniforms }: { source: string; uniforms: Uniforms }) => {
    const { size } = useThree();
    const ref = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!ref.current) return;
        (ref.current.material as any).uniforms.u_time.value = clock.getElapsedTime();
    });

    const getUniforms = () => {
        const out: any = {};
        for (const name in uniforms) {
            const u: any = uniforms[name];
            switch (u.type) {
                case "uniform1f": out[name] = { value: u.value }; break;
                case "uniform1i": out[name] = { value: u.value }; break;
                case "uniform1fv": out[name] = { value: u.value }; break;
                case "uniform3fv": out[name] = { value: (u.value as number[][]).map((v) => new THREE.Vector3().fromArray(v)) }; break;
                case "uniform3f": out[name] = { value: new THREE.Vector3().fromArray(u.value as number[]) }; break;
                case "uniform2f": out[name] = { value: new THREE.Vector2().fromArray(u.value as number[]) }; break;
            }
        }
        out.u_time = { value: 0 };
        out.u_resolution = { value: new THREE.Vector2(size.width * 2, size.height * 2) };
        return out;
    };

    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                vertexShader: `
          precision mediump float;
          uniform vec2 u_resolution;
          out vec2 fragCoord;
          void main() {
            gl_Position = vec4(position.xy, 0.0, 1.0);
            fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
            fragCoord.y = u_resolution.y - fragCoord.y;
          }`,
                fragmentShader: source,
                uniforms: getUniforms(),
                glslVersion: THREE.GLSL3,
                blending: THREE.CustomBlending,
                blendSrc: THREE.SrcAlphaFactor,
                blendDst: THREE.OneFactor,
            }),
        [size.width, size.height, source] // eslint-disable-line react-hooks/exhaustive-deps
    );

    return (
        <mesh ref={ref as any}>
            <planeGeometry args={[2, 2]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
};

const Shader: React.FC<ShaderProps> = ({ source, uniforms, maxFps = 60 }) => (
    <Canvas className="absolute inset-0 h-full w-full">
        <ShaderMaterialComponent source={source} uniforms={uniforms} />
    </Canvas>
);

// ─── Icons ────────────────────────────────────────────────────────────────────

export const GitHubIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
);

// ─── Mini Navbar ──────────────────────────────────────────────────────────────

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} className="group inline-flex overflow-hidden h-5 items-center text-sm">
        <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
            <span className="text-gray-300">{children}</span>
            <span className="text-white">{children}</span>
        </div>
    </a>
);

export function MiniNavbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [shapeClass, setShapeClass] = useState("rounded-full");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (isOpen) {
            setShapeClass("rounded-xl");
        } else {
            timerRef.current = setTimeout(() => setShapeClass("rounded-full"), 300);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [isOpen]);

    const navLinks = [
        { label: "Manifesto", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Discover", href: "#" },
    ];

    const Logo = () => (
        <div className="relative w-5 h-5 flex items-center justify-center">
            {["top-0 left-1/2 -translate-x-1/2", "left-0 top-1/2 -translate-y-1/2", "right-0 top-1/2 -translate-y-1/2", "bottom-0 left-1/2 -translate-x-1/2"].map((pos, i) => (
                <span key={i} className={`absolute w-1.5 h-1.5 rounded-full bg-gray-200 opacity-80 ${pos}`} />
            ))}
        </div>
    );

    return (
        <header
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center
        pl-6 pr-6 py-3 backdrop-blur-sm border border-[#333] bg-[#1f1f1f57]
        w-[calc(100%-2rem)] sm:w-auto ${shapeClass} transition-[border-radius] duration-300`}
        >
            <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
                <Logo />
                <nav className="hidden sm:flex items-center space-x-6 text-sm">
                    {navLinks.map((l) => <AnimatedNavLink key={l.href} href={l.href}>{l.label}</AnimatedNavLink>)}
                </nav>
                <div className="hidden sm:flex items-center gap-3">
                    <Link href="/signin" className="px-4 py-2 text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors">
                        Login
                    </Link>
                    <Link href="/sign-up" className="px-4 py-2 text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all">
                        Signup
                    </Link>
                </div>
                <button className="sm:hidden w-8 h-8 text-gray-300" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen
                        ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    }
                </button>
            </div>

            <div className={`sm:hidden flex flex-col items-center w-full overflow-hidden transition-all duration-300
        ${isOpen ? "max-h-96 opacity-100 pt-4" : "max-h-0 opacity-0 pointer-events-none"}`}
            >
                <nav className="flex flex-col items-center space-y-4 w-full">
                    {navLinks.map((l) => (
                        <a key={l.label} href={l.href} className="text-gray-300 hover:text-white transition-colors text-center w-full">{l.label}</a>
                    ))}
                </nav>
                <div className="flex flex-col items-center space-y-3 mt-4 w-full">
                    <Link href="/signin" className="w-full text-center px-4 py-2 text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full">Login</Link>
                    <Link href="/sign-up" className="w-full text-center px-4 py-2 text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full">Signup</Link>
                </div>
            </div>
        </header>
    );
}

// ─── Main Sign-In Page ────────────────────────────────────────────────────────

