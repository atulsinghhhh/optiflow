"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const navItems = [
  { name: "Features", href: "#features" },
  { name: "How it works", href: "#how-it-works" },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
    if (latest > 20) setMobileOpen(false);
  });

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl border-b border-slate-200 h-16"
          : "bg-transparent h-20 border-b border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto flex h-full items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-semibold text-lg tracking-tight text-[#0A2540]">
            OptiFlow
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-slate-600 hover:text-[#0A2540] transition-colors"
            >
              {item.name}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/signin"
            className="text-sm font-medium text-slate-600 hover:text-[#0A2540] transition-colors px-3 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold bg-[#0A2540] text-white px-4 py-2.5 rounded-full hover:bg-[#0A2540]/90 transition-colors"
          >
            Get started
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-[#0A2540]"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white border-b border-slate-200 md:hidden"
          >
            <div className="flex flex-col px-6 py-6 gap-5">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-sm font-medium text-slate-600"
                >
                  {item.name}
                </a>
              ))}
              <Link href="/signin" className="text-sm font-medium text-slate-600">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-semibold text-white bg-[#0A2540] rounded-full py-3 text-center"
              >
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
