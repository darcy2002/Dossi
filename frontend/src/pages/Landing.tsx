import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, MessageSquareText, Workflow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

const features = [
  { icon: Workflow, title: "Autonomous research", body: "A multi-step agent plans, searches, and self-checks until the briefing is solid." },
  { icon: FileSearch, title: "Structured briefings", body: "Nine sections: overview, products, customers, signals, risks, discovery questions, and more." },
  { icon: MessageSquareText, title: "Grounded chat", body: "Ask follow-ups answered only from the gathered research — no hallucinations." },
];

export function Landing() {
  const { token } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold">
          doss<span className="text-primary">i</span>
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to={token ? "/app" : "/login"}>
            <Button variant="ghost" size="sm">{token ? "Open app" : "Log in"}</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              AI research copilot for meeting prep
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Walk into every meeting{" "}
              <span className="text-primary">already briefed.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Give Dossi a company, a website, and your objective. It researches
              the company and hands you a structured briefing you can interrogate.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/signup">
                <Button size="md" className="gap-2">
                  Get started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="md">I have an account</Button>
              </Link>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-5 pb-24 sm:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.1 }}
              className="rounded-lg border border-border bg-card p-6"
            >
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </main>
    </div>
  );
}
