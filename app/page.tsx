import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Cloud,
  Shield,
  Zap,
  BarChart3,
  Lock,
  Share2,
  RefreshCw,
  CheckCircle2,
  Globe,
  HardDrive
} from "lucide-react";
import { CTASection } from "@/components/ui/hero-dithering-card";
import { AnimatedNavFramer } from "@/components/ui/navigation-menu";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AnimatedNavFramer />

      <main className="flex-1">
        {/* ── Hero Section ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-36 pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-fuchsia-600/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center">
            <div className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-300 mb-8 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse" />
              OptiFlow v1.0 is now live
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
              Store, scale, and share with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                absolute precision.
              </span>
            </h1>

            <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              The modern cloud storage architecture built for speed and beautiful analytics.
              Secure your files, analyze your usage, and share seamlessly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.6)] transition-all hover:scale-105"
                >
                  Start for free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/signin">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg rounded-full border-border/50 bg-background/50 backdrop-blur-md hover:bg-muted/50"
                >
                  Access Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 bg-card/30 relative overflow-hidden">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Powerful Features</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Everything you need to manage your cloud asset ecosystem efficiently.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl group hover:border-violet-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Cloud className="text-violet-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Unlimited Scale</h3>
                <p className="text-muted-foreground">
                  Store documents and images of any size. Distributed storage built to handle enterprise needs.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl relative overflow-hidden group hover:border-fuchsia-500/50 transition-all">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 blur-2xl rounded-full" />
                <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="text-fuchsia-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 relative z-10">Real-time Analytics</h3>
                <p className="text-muted-foreground relative z-10">
                  Dynamic dashboards showing file distribution and upload velocity instantly.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl group hover:border-cyan-500/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="text-cyan-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Secure Sharing</h3>
                <p className="text-muted-foreground">
                  Generate self-destructing secure links to share your files with anyone, instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="analytics" className="py-24 relative overflow-hidden flex items-center">
          <div className="container mx-auto px-4 max-w-7xl grid md:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 md:order-1">
              <div className="absolute -inset-4 bg-gradient-to-tr from-violet-600/20 to-fuchsia-600/20 blur-3xl opacity-30 rounded-full" />
              <div className="relative bg-background/40 border border-border/50 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Usage Report</p>
                      <h4 className="font-bold">Team Activity</h4>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">LIVE</div>
                </div>
                <div className="space-y-4">
                  {[
                    { label: "Document Uploads", val: "84%", color: "bg-violet-500" },
                    { label: "Image Processing", val: "62%", color: "bg-fuchsia-500" },
                    { label: "Storage Capacity", val: "24%", color: "bg-cyan-500" },
                  ].map((stat) => (
                    <div key={stat.label} className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{stat.label}</span>
                        <span className="font-bold">{stat.val}</span>
                      </div>
                      <div className="h-1.5 w-full bg-border/20 rounded-full overflow-hidden">
                        <div className={`h-full ${stat.color} transition-all duration-1000`} style={{ width: stat.val }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl font-bold tracking-tight mb-6">Drive decisions with <br /><span className="text-violet-400">Deep Analytics.</span></h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                OptiFlow doesn't just store your data — it interprets it. Get granular insights into how your team interacts with assets.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: <RefreshCw size={18} />, text: "Real-time upload velocity monitoring" },
                  { icon: <Lock size={18} />, text: "Audit logs for every file interaction" },
                  { icon: <Share2 size={18} />, text: "Advanced engagement share tracking" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium p-3 rounded-xl bg-muted/30 border border-border/20">
                    <span className="text-violet-400">{item.icon}</span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="storage" className="py-24 bg-muted/10 relative border-y border-border/20">
          <div className="container mx-auto px-4 max-w-7xl grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold tracking-tight mb-6">Built on <span className="text-fuchsia-400">Modern Architecture.</span></h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Say goodbye to slow loading times. Our distributed storage layer ensures your files are available instantly, anywhere in the world.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Uptime", val: "99.99%", desc: "Guaranteed availability" },
                  { label: "Execution", val: "<10ms", desc: "Edge functions speed" },
                  { label: "Storage", val: "AES-256", desc: "Military grade encryption" },
                  { label: "CDN", val: "300+", desc: "Global edge locations" },
                ].map((box) => (
                  <div key={box.label} className="p-4 rounded-2xl bg-background border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">{box.label}</p>
                    <p className="text-xl font-bold">{box.val}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{box.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-20 bg-fuchsia-600/10 blur-[120px] rounded-full opacity-50 pointer-events-none" />
              <div className="relative bg-background p-4 rounded-[32px] border border-border/80 shadow-2xl">
                <div className="aspect-square bg-grid-white/5 rounded-2xl overflow-hidden flex items-center justify-center text-fuchsia-500/20">
                  <HardDrive size={120} strokeWidth={0.5} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 relative">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-16">Three steps to flow.</h2>
            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent -translate-y-1/2 hidden md:block" />
              {[
                { step: "01", title: "Connect", desc: "Sync your existing cloud buckets or start fresh with our encrypted vault." },
                { step: "02", title: "Organize", desc: "Auto-tagging and intelligent folders keep your assets structured perfectly." },
                { step: "03", title: "Scale", desc: "Enable team collaboration and high-speed sharing with advanced permissions." },
              ].map((item, idx) => (
                <div key={idx} className="relative z-10 flex flex-col items-center group">
                  <div className="w-14 h-14 rounded-2xl bg-background border-2 border-border flex items-center justify-center font-bold text-lg mb-6 group-hover:border-violet-500 transition-colors shadow-xl">
                    {item.step}
                  </div>
                  <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-24 bg-card/10 border-t border-border/40">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Pricing that scales.</h2>
              <p className="text-muted-foreground">Start for free, upgrade as your team grows.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { name: "Starter", price: "0", features: ["10GB Storage", "2 Team members", "Basic Analytics"], cta: "Get Started", primary: false },
                { name: "Pro", price: "24", features: ["100GB Storage", "10 Team members", "Deep Analytics", "Custom Domain"], cta: "Try Pro", primary: true },
                { name: "Enterprise", price: "99", features: ["Unlimited Storage", "Unlimited Teams", "API Access", "SSO & Security"], cta: "Contact Sales", primary: false },
              ].map((plan) => (
                <div key={plan.name} className={`p-8 rounded-[32px] border ${plan.primary ? 'border-violet-500 bg-violet-500/5 shadow-[0_0_40px_-10px_rgba(139,92,246,0.2)]' : 'border-border/60 bg-background'} flex flex-col`}>
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6 text-4xl font-extrabold tracking-tighter">
                    ${plan.price}
                    <span className="text-sm font-normal text-muted-foreground tracking-normal">/mo</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm font-medium">
                        <CheckCircle2 size={16} className="text-violet-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full h-12 rounded-2xl font-bold ${plan.primary ? 'bg-violet-600 hover:bg-violet-500' : 'bg-muted/50 hover:bg-muted font-medium'}`} variant={plan.primary ? "default" : "secondary"}>
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-border/40 py-12 bg-background flex items-center justify-center">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8 max-w-7xl">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            OptiFlow
          </div>
          <p className="text-muted-foreground text-xs">© 2026 OptiFlow Architecture. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">Privacy</Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground">Terms</Link>
            <Link href="#" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Globe size={12} /> Global</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
