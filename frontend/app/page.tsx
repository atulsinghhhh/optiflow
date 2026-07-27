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
    tint: "bg-[#635BFF]/10 text-[#635BFF]",
    title: "Async image processing",
    description:
      "Every image upload is queued and thumbnailed by a dedicated background worker, so your dashboard never blocks on heavy processing.",
  },
  {
    icon: History,
    tint: "bg-[#00B287]/10 text-[#00B287]",
    title: "Automatic versioning",
    description:
      "Re-upload a file with the same name and the previous version is archived automatically — full history, no overwrites.",
  },
  {
    icon: Share2,
    tint: "bg-[#FF5C5C]/10 text-[#FF5C5C]",
    title: "Secure sharing",
    description:
      "Generate expiring share links or send a file straight to a teammate's inbox by email — they get notified instantly.",
  },
  {
    icon: FolderTree,
    tint: "bg-[#FFA23A]/10 text-[#C4780A]",
    title: "Organized storage",
    description:
      "Nest files inside folders, search across your library, and keep everything structured the way your team actually works.",
  },
  {
    icon: Bell,
    tint: "bg-[#00A3FF]/10 text-[#0091E0]",
    title: "Stay in the loop",
    description:
      "Uploads, renames, deletes, and shares all raise a notification — so nothing changes without you knowing.",
  },
  {
    icon: ShieldCheck,
    tint: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
    title: "Built on solid foundations",
    description:
      "Next.js, PostgreSQL, Redis, and MinIO under the hood — durable storage and a queue that scales with you.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Drop a file into OptiFlow. It's validated and streamed straight to object storage.",
  },
  {
    number: "02",
    title: "Process",
    description: "Images are pushed to a Redis queue and picked up by a worker that generates an optimized thumbnail.",
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
    <div className="flex flex-col min-h-screen bg-white text-[#0A2540]">
      <LandingNavbar />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-40 pb-28 px-6">
          {/* gradient mesh background */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-[#635BFF] opacity-20 blur-[120px]" />
            <div className="absolute -top-20 right-1/4 w-[30rem] h-[30rem] rounded-full bg-[#00A3FF] opacity-20 blur-[120px]" />
            <div className="absolute top-40 left-1/3 w-[24rem] h-[24rem] rounded-full bg-[#FF80B5] opacity-15 blur-[110px]" />
          </div>

          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 backdrop-blur px-4 py-1.5 text-xs font-medium text-slate-600 mb-8 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B287]" />
              Now processing images through a live worker pipeline
            </div>

            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
              File infrastructure
              <br />
              <span className="bg-gradient-to-r from-[#635BFF] via-[#8B5CF6] to-[#00A3FF] bg-clip-text text-transparent">
                for teams who ship fast.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload, version, process, and share files through one clean dashboard —
              backed by async image processing, folders, and secure sharable links.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-12 px-7 text-base rounded-full bg-[#0A2540] text-white hover:bg-[#0A2540]/90 transition-all font-semibold"
                >
                  Start for free
                </Button>
              </Link>
              <Link href="/signin">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-base rounded-full border-slate-300 text-[#0A2540] hover:bg-slate-50 transition-all"
                >
                  Sign in <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* floating product mockup */}
          <div className="relative max-w-4xl mx-auto mt-20 hidden sm:block">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 bg-slate-50">
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="ml-4 text-xs font-mono text-slate-400">
                  optiflow.app/dashboard/files
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { name: "product-hero.png", size: "2.4 MB", status: "Completed", dot: "bg-[#00B287]" },
                  { name: "quarterly-report.pdf", size: "8.1 MB", status: "Completed", dot: "bg-[#00B287]" },
                  { name: "banner-draft.jpg", size: "1.2 MB", status: "Processing", dot: "bg-[#FFA23A] animate-pulse" },
                  { name: "onboarding-deck.docx", size: "3.7 MB", status: "Completed", dot: "bg-[#00B287]" },
                ].map((file) => (
                  <div key={file.name} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-[#635BFF]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0A2540]">{file.name}</p>
                        <p className="text-xs text-slate-400">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className={`w-1.5 h-1.5 rounded-full ${file.dot}`} />
                      {file.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* floating storage card */}
            <div className="absolute -bottom-8 -left-6 w-56 rounded-xl border border-slate-200 bg-white shadow-xl p-4 hidden md:block rotate-[-3deg]">
              <p className="text-xs text-slate-400 mb-2">Storage used</p>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-[#635BFF] to-[#00A3FF]" />
              </div>
              <p className="text-xs font-medium text-[#0A2540]">640 MB of 1 GB</p>
            </div>

            {/* floating notification card */}
            <div className="absolute -top-6 -right-6 rounded-xl border border-slate-200 bg-white shadow-xl px-4 py-3 hidden md:flex items-center gap-2 rotate-[3deg]">
              <div className="w-6 h-6 rounded-full bg-[#00B287]/10 flex items-center justify-center">
                <Bell className="w-3 h-3 text-[#00B287]" />
              </div>
              <p className="text-xs font-medium text-[#0A2540]">Thumbnail ready</p>
            </div>
          </div>
        </section>

        {/* ── Tech strip ───────────────────────────────────────────────── */}
        <section className="border-y border-slate-100 py-8 px-6 bg-slate-50/50">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-medium">
              Built on
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-slate-400">
              <span>Next.js</span>
              <span>PostgreSQL</span>
              <span>Prisma</span>
              <span>Redis</span>
              <span>MinIO</span>
              <span>Sharp</span>
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
              <p className="text-slate-600 text-lg">
                No bloat, no fake dashboards — just the pieces you need to store,
                process, and share files reliably.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-white"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${feature.tint}`}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-[#0A2540] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-28 px-6 bg-slate-50/50 border-y border-slate-100">
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
                    <span className="text-sm font-mono text-[#635BFF] font-semibold">
                      {step.number}
                    </span>
                    {i < steps.length - 1 && (
                      <span className="hidden md:block h-px flex-1 bg-slate-200" />
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-[#0A2540] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="py-28 px-6">
          <div className="max-w-5xl mx-auto rounded-3xl bg-[#0A2540] px-8 py-16 md:py-20 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
              <div className="absolute -top-24 left-1/4 w-80 h-80 rounded-full bg-[#635BFF] opacity-30 blur-[100px]" />
              <div className="absolute -bottom-24 right-1/4 w-80 h-80 rounded-full bg-[#00A3FF] opacity-20 blur-[100px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white mb-6">
                Ready to organize your files?
              </h2>
              <p className="text-slate-300 text-lg mb-10 max-w-xl mx-auto">
                Create an account and start uploading in under a minute.
              </p>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base rounded-full bg-white text-[#0A2540] hover:bg-slate-100 transition-all font-semibold"
                >
                  Create your account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#0A2540]">OptiFlow</span>
          </div>
          <p className="text-slate-400 text-sm">© 2026 OptiFlow. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-slate-400 hover:text-[#0A2540] transition-colors">
              Terms
            </Link>
            <Link href="#" className="text-sm text-slate-400 hover:text-[#0A2540] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
