import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingNavbar } from "@/components/landing/navbar";
import {
  ArrowRight,
  ImageIcon,
  History,
  Share2,
  Bell,
  FolderTree,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: ImageIcon,
    tint: "bg-primary/10 text-primary",
    title: "Async image processing",
    description:
      "Every image upload is queued and thumbnailed by a dedicated background worker, so your dashboard never blocks on heavy processing.",
  },
  {
    icon: History,
    tint: "bg-success/10 text-success",
    title: "Automatic versioning",
    description:
      "Re-upload a file with the same name and the previous version is archived automatically — full history, no overwrites.",
  },
  {
    icon: Share2,
    tint: "bg-destructive/10 text-destructive",
    title: "Secure sharing",
    description:
      "Generate expiring share links or send a file straight to a teammate's inbox by email — they get notified instantly.",
  },
  {
    icon: FolderTree,
    tint: "bg-warning/10 text-warning",
    title: "Organized storage",
    description:
      "Nest files inside folders, search across your library, and keep everything structured the way your team actually works.",
  },
  {
    icon: Bell,
    tint: "bg-accent/10 text-accent",
    title: "Stay in the loop",
    description:
      "Uploads, renames, deletes, and shares all raise a notification — so nothing changes without you knowing.",
  },
  {
    icon: ShieldCheck,
    tint: "bg-primary/10 text-primary",
    title: "Built on solid foundations",
    description:
      "Go, PostgreSQL, Redis, and MinIO under the hood — durable storage and a queue that scales with you.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Drop a file into StreamVault. It's validated and streamed straight to object storage.",
  },
  {
    number: "02",
    title: "Process",
    description: "Images and video are pushed to a Redis queue and picked up by a worker that generates a thumbnail or HLS rendition.",
  },
  {
    number: "03",
    title: "Organize",
    description: "Sort files into folders, track versions, and search your whole library in an instant.",
  },
  {
    number: "04",
    title: "Share",
    description: "Send a secure link or share directly with a teammate's email — with optional expiration.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-40 pb-28 px-6">
          {/* gradient mesh background */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-primary opacity-20 blur-[120px]" />
            <div className="absolute -top-20 right-1/4 w-[30rem] h-[30rem] rounded-full bg-accent opacity-20 blur-[120px]" />
            <div className="absolute top-40 left-1/3 w-[24rem] h-[24rem] rounded-full bg-destructive opacity-15 blur-[110px]" />
          </div>

          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Now processing images and video through a live worker pipeline
            </div>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
              File infrastructure
              <br />
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                for teams who ship fast.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload, version, process, and share files through one clean dashboard —
              backed by async image/video processing, folders, and secure sharable links.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-12 px-7 text-base rounded-full bg-ink text-ink-foreground hover:bg-ink/90 transition-all font-semibold"
                >
                  Start for free
                </Button>
              </Link>
              <Link href="/signin">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-base rounded-full border-border text-foreground hover:bg-muted transition-all"
                >
                  Sign in <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* floating product mockup */}
          <div className="relative max-w-4xl mx-auto mt-20 hidden sm:block">
            <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-5 py-3 bg-muted">
                <span className="w-3 h-3 rounded-full bg-border" />
                <span className="w-3 h-3 rounded-full bg-border" />
                <span className="w-3 h-3 rounded-full bg-border" />
                <span className="ml-4 text-xs font-mono text-muted-foreground">
                  streamvault.app/dashboard/files
                </span>
              </div>
              <div className="divide-y divide-border">
                {[
                  { name: "product-hero.png", size: "2.4 MB", status: "Ready", dot: "bg-success" },
                  { name: "quarterly-report.pdf", size: "8.1 MB", status: "Ready", dot: "bg-success" },
                  { name: "banner-draft.jpg", size: "1.2 MB", status: "Processing", dot: "bg-warning animate-pulse" },
                  { name: "onboarding-deck.docx", size: "3.7 MB", status: "Ready", dot: "bg-success" },
                ].map((file) => (
                  <div key={file.name} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={`w-1.5 h-1.5 rounded-full ${file.dot}`} />
                      {file.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* floating storage card */}
            <div className="absolute -bottom-8 -left-6 w-56 rounded-xl border border-border bg-card shadow-xl p-4 hidden md:block rotate-[-3deg]">
              <p className="text-xs text-muted-foreground mb-2">Storage used</p>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
              <p className="text-xs font-medium text-foreground">640 MB of 1 GB</p>
            </div>

            {/* floating notification card */}
            <div className="absolute -top-6 -right-6 rounded-xl border border-border bg-card shadow-xl px-4 py-3 hidden md:flex items-center gap-2 rotate-[3deg]">
              <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                <Bell className="w-3 h-3 text-success" />
              </div>
              <p className="text-xs font-medium text-foreground">Thumbnail ready</p>
            </div>
          </div>
        </section>

        {/* ── Tech strip ───────────────────────────────────────────────── */}
        <section className="border-y border-border py-8 px-6 bg-muted/50">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Built on
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-muted-foreground">
              <span>Go</span>
              <span>PostgreSQL</span>
              <span>Redis</span>
              <span>MinIO</span>
              <span>ffmpeg</span>
              <span>Next.js</span>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section id="features" className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
                Everything a file layer should do
              </h2>
              <p className="text-muted-foreground text-lg">
                No bloat, no fake dashboards — just the pieces you need to store,
                process, and share files reliably.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-card"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${feature.tint}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-28 px-6 bg-muted/50 border-y border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
                From upload to shared link, in four steps
              </h2>
            </div>

            <div className="grid md:grid-cols-4 gap-8 md:gap-6">
              {steps.map((step, i) => (
                <div key={step.number} className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-mono text-primary font-semibold">
                      {step.number}
                    </span>
                    {i < steps.length - 1 && (
                      <span className="hidden md:block h-px flex-1 bg-border" />
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto rounded-3xl bg-ink px-8 py-16 md:py-20 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
              <div className="absolute -top-24 left-1/4 w-80 h-80 rounded-full bg-primary opacity-30 blur-[100px]" />
              <div className="absolute -bottom-24 right-1/4 w-80 h-80 rounded-full bg-accent opacity-20 blur-[100px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-ink-foreground mb-6">
                Ready to organize your files?
              </h2>
              <p className="text-ink-foreground/70 text-lg mb-10 max-w-xl mx-auto">
                Create an account and start uploading in under a minute.
              </p>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base rounded-full bg-ink-foreground text-ink hover:bg-ink-foreground/90 transition-all font-semibold"
                >
                  Create your account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">StreamVault</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2026 StreamVault. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
