import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Cloud, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Image
              src="/logo.png"
              alt="OptiFlow Logo"
              width={32}
              height={32}
              className="rounded-xl drop-shadow-[0_0_10px_rgba(139,92,246,0.5)] bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20"
            />
            OptiFlow
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg rounded-full px-6">
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-24 pb-32">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-background to-background" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-fuchsia-600/10 blur-[120px] rounded-full point-events-none" />

          <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl text-center">
            <div className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-300 mb-8 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
              OptiFlow v1.0 is now live
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
              Store, scale, and share with <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">absolute precision.</span>
            </h1>

            <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              The modern cloud storage architecture built for speed and beautiful analytics. Secure your files, analyze your usage, and share seamlessly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/sign-up">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-[0_0_40px_-10px_rgba(139,92,246,0.6)] transition-all hover:scale-105">
                  Start for free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/signin">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-border/50 bg-background/50 backdrop-blur-md hover:bg-muted/50">
                  Access Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="py-24 bg-card/30 border-t border-border/50 relative">
          <div className="container mx-auto px-4 max-w-7xl">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl">
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-6">
                  <Cloud className="text-violet-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Unlimited Scale</h3>
                <p className="text-muted-foreground">Store documents and images of any size. Distributed storage built to handle enterprise needs.</p>
              </div>
              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 blur-2xl rounded-full" />
                <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-6">
                  <Zap className="text-fuchsia-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3 relative z-10">Real-time Analytics</h3>
                <p className="text-muted-foreground relative z-10">Dynamic dashboards showing file distribution and upload velocity instantly.</p>
              </div>
              <div className="p-8 rounded-3xl bg-background/50 border border-border/50 backdrop-blur-xl">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                  <Shield className="text-cyan-400" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">Secure Sharing</h3>
                <p className="text-muted-foreground">Generate self-destructing secure links to share your files with anyone, instantly.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8 bg-background">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2026 OptiFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
