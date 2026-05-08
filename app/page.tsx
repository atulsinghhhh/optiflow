import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { AnimatedNavFramer } from "@/components/ui/navigation-menu";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0F172A] selection:bg-white/10">
      <AnimatedNavFramer />

      <main className="flex-1 flex flex-col items-center justify-center pt-20">
        {/* ── Refined Hero Section ─────────────────────────────────────────── */}
        <section className="w-full max-w-7xl mx-auto px-6 py-24 md:py-40">
          <div className="flex flex-col items-start max-w-4xl">
            <div className="mb-6 overflow-hidden">
              <span className="inline-block animate-in slide-in-from-bottom-full duration-700 text-xs font-mono uppercase tracking-[0.3em] text-slate-500">
                Next Generation Storage
              </span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-medium tracking-tight text-white mb-12 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
              Storage, <br />
              <span className="text-slate-500 italic">refined.</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mb-16 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
              OptiFlow is a utilitarian cloud asset layer. 
              No fluff. Just high-performance storage and 
              precise analytics for modern teams.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-300">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-16 px-10 text-lg rounded-none bg-white text-[#0F172A] hover:bg-slate-200 transition-all font-semibold"
                >
                  Create Account
                </Button>
              </Link>
              <Link href="/signin">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-16 px-10 text-lg rounded-none border-slate-700 text-slate-300 hover:bg-slate-800 transition-all"
                >
                  Sign In <ArrowRight className="ml-2 h-5 w-5 opacity-50" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Minimal Utility Section ──────────────────────────────────────── */}
        <section className="w-full border-t border-slate-800/50 py-24 bg-slate-900/20">
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-16">
            <div>
              <h3 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-4">Utility 01</h3>
              <p className="text-slate-300 font-medium leading-relaxed">
                Distributed object storage layer with native chunking support for files up to 500MB.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-4">Utility 02</h3>
              <p className="text-slate-300 font-medium leading-relaxed">
                Automated image processing and optimization through a dedicated Redis-backed pipeline.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-4">Utility 03</h3>
              <p className="text-slate-300 font-medium leading-relaxed">
                Secure, token-based link sharing with automated expiration and recipient tracking.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <span className="font-bold text-lg tracking-tight text-white uppercase italic">
            OptiFlow
          </span>
          <p className="text-slate-500 text-xs font-mono tracking-widest">© 2026 / UTILITY OVER AESTHETICS</p>
          <div className="flex items-center gap-8">
            <Link href="#" className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-mono">Terms</Link>
            <Link href="#" className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-mono">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
