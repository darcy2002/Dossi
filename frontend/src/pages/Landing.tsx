import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Clock, FileText, History,
  Link2, MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground", center && "justify-center")}>
      <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]" />
      {children}
    </span>
  );
}

const FEATURES = [
  { n: "01", icon: FileText, t: "Structured briefings", d: "Company overview, products, target customers, business signals, risks, and a suggested outreach strategy — organized, not dumped." },
  { n: "02", icon: Clock, t: "Live research workflow", d: "Watch it plan, gather sources, analyze findings, run a quality check, and write the report — in real time." },
  { n: "03", icon: MessageSquareText, t: "Grounded follow-up chat", d: "Ask anything about the briefing. Answers come only from the research it gathered — no hallucinated facts." },
  { n: "04", icon: Link2, t: "Sources you can trust", d: "Every briefing links back to where the facts came from, so you can verify and dig deeper before you walk in." },
  { n: "05", icon: CheckCircle2, t: "Built-in quality check", d: "If coverage looks thin, Dossi flags it and gathers more before finishing — and tells you what's still unknown." },
  { n: "06", icon: History, t: "Every briefing, saved", d: "Your research history is always one click away — ready before the next call, searchable across companies." },
];

const STEPS = [
  { i: "Step 01", t: "Describe the meeting", d: "Type the company, their website, and your objective — \"Prep for a sales meeting with their GTM team.\"" },
  { i: "Step 02", t: "Dossi researches", d: "It plans, gathers sources across the web, analyzes, and quality-checks — then writes a structured briefing." },
  { i: "Step 03", t: "Read & ask", d: "Skim the briefing, then ask follow-ups in a grounded chat. Walk in knowing exactly what to say." },
];

const USE_CASES = [
  { t: "Sales discovery", items: ["Tailored discovery questions per account", "Signals and triggers worth opening with", "Who likely owns the buying decision"] },
  { t: "Investor & partner calls", items: ["Business model and traction at a glance", "Risks and challenges before you commit", "The unknowns worth asking about"] },
  { t: "Account expansion", items: ["What changed since you last spoke", "New hiring, funding, and product signals", "Angles to grow the relationship"] },
];

export function Landing() {
  const { token } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        backgroundImage:
          "radial-gradient(1100px 560px at 50% -10%, hsl(var(--primary)/0.16), transparent 60%), radial-gradient(800px 460px at 85% 6%, hsl(var(--primary)/0.07), transparent 70%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Nav */}
      <nav className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-md transition-colors",
        scrolled ? "border-border bg-background/80" : "border-transparent bg-background/50"
      )}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top" className="text-lg font-bold tracking-tight">doss<span className="text-primary">i</span></a>
          <div className="hidden gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#usecases" className="hover:text-foreground">Use cases</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to={token ? "/app" : "/login"}><Button variant="outline" size="sm">{token ? "Open app" : "Sign in"}</Button></Link>
            <Link to="/signup" className="hidden sm:block"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </nav>

      <main id="top" className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="relative pb-12 pt-16 text-center sm:pt-24">
          <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex justify-center">
              <Eyebrow center>AI research copilot for meeting prep</Eyebrow>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }}
              className="mx-auto mt-6 max-w-[16ch] text-5xl font-medium leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Walk into every meeting{" "}
              <span className="font-serif-italic font-normal text-primary">knowing everything.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16 }}
              className="mx-auto mt-6 max-w-[60ch] text-lg leading-relaxed text-muted-foreground"
            >
              Give Dossi a company, a website, and your objective. It researches across the web and hands you a
              structured briefing — overview, signals, risks, and the questions to ask — then answers your follow-ups in a grounded chat.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              <Link to="/signup"><Button size="md" className="gap-2 px-5">Get started free <ArrowRight className="h-4 w-4" /></Button></Link>
              <a href="#how"><Button variant="outline" size="md" className="px-5">See how it works</Button></a>
            </motion.div>
            <div className="mt-8 flex flex-wrap justify-center gap-9">
              {[["~1 min", "From objective to briefing"], ["8+ sources", "Cross-checked per run"], ["Grounded", "Answers cite the research"]].map(([n, l]) => (
                <div key={l} className="flex flex-col gap-0.5">
                  <span className="font-mono text-sm font-medium text-primary">{n}</span>
                  <span className="text-xs text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Browser-framed product preview */}
          <motion.div
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.35 }}
            className="relative mx-auto mt-16 max-w-4xl"
          >
            <div className="absolute -inset-8 rounded-[2rem] bg-[hsl(var(--primary)/0.16)] blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex gap-1.5">
                  {["", "", ""].map((_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-border" />)}
                </div>
                <span className="mx-auto rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-muted-foreground">dossi.app</span>
                <span className="w-12" />
              </div>
              <div className="relative aspect-video w-full bg-background">
                <iframe
                  src="/dossi-film.html?embed=1"
                  title="dossi in 10 seconds"
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="py-20">
          <div className="mb-10 max-w-2xl">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Everything you need before the call</h2>
            <p className="mt-3 text-lg text-muted-foreground">Not a wall of search results — a briefing built for the conversation you're about to have.</p>
          </div>
          <div className="grid overflow-hidden rounded-2xl border border-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.n}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
                className="relative flex min-h-[210px] flex-col gap-3.5 border-b border-r border-border bg-card/40 p-7 transition-colors hover:bg-card"
              >
                <span className="absolute right-5 top-5 font-mono text-[11px] text-muted-foreground/60">{f.n}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></span>
                <h3 className="text-lg font-medium">{f.t}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-20">
          <div className="mb-10 text-center">
            <div className="flex justify-center"><Eyebrow center>How it works</Eyebrow></div>
            <h2 className="mx-auto mt-3 max-w-[18ch] text-3xl font-medium tracking-tight sm:text-4xl">Three steps. About a minute.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card/40 p-7 transition-all hover:-translate-y-0.5 hover:border-primary/40"
              >
                <span className="flex items-center gap-2.5 font-mono text-xs text-primary">
                  <span className="h-px w-5 bg-primary" /> {s.i}
                </span>
                <h4 className="mt-3 text-lg font-medium">{s.t}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section id="usecases" className="py-20">
          <div className="mb-10 max-w-2xl">
            <Eyebrow>Who it's for</Eyebrow>
            <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">For anyone who walks into rooms cold</h2>
            <p className="mt-3 text-lg text-muted-foreground">Sellers, founders, investors, partnerships — anyone who needs to sound informed, fast.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {USE_CASES.map((uc) => (
              <div key={uc.t} className="rounded-2xl border border-border bg-card/40 p-7 transition-colors hover:border-primary/40 hover:bg-card">
                <h3 className="text-lg font-medium">{uc.t}</h3>
                <ul className="mt-4 space-y-2.5">
                  {uc.items.map((it) => (
                    <li key={it} className="flex gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-12">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-16 text-center"
            style={{ backgroundImage: "radial-gradient(600px 320px at 50% 120%, hsl(var(--primary)/0.18), transparent 60%)" }}>
            <div className="flex justify-center"><Eyebrow center>Get started</Eyebrow></div>
            <h2 className="mx-auto mt-4 max-w-[18ch] text-4xl font-medium tracking-tight sm:text-5xl">
              Stop walking in <span className="font-serif-italic font-normal text-primary">cold.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-muted-foreground">
              Your first briefings are free. Give Dossi a company and an objective — see what a minute of research gets you.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/signup"><Button size="md" className="gap-2 px-6">Get started free <ArrowRight className="h-4 w-4" /></Button></Link>
              <a href="#top"><Button variant="outline" size="md" className="px-5">Back to top</Button></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground">
          <span>© 2026 dossi. All rights reserved.</span>
          <span className="font-mono">research · brief · walk in ready</span>
        </div>
      </footer>
    </div>
  );
}
