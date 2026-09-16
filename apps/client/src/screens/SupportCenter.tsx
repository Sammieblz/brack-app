import { useEffect, useMemo, useState } from "react";
import { Search } from "iconoir-react";
import { Link, useLocation } from "react-router-dom";
import { SupportContact } from "@/components/settings/SupportContact";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

const faqs = [
  { question: "How do I reset my password?", answer: "On the sign-in screen, choose Forgot password. If you are signed in, you can also use Account in Settings." },
  { question: "How do I export my reading data?", answer: "Open Settings, then Data & Backup. Choose the export option there." },
  { question: "Can I use Brack while offline?", answer: "Your saved library and core reading updates can remain available offline. Support messages need a connection before they can be sent." },
  { question: "How do I report a problem?", answer: "Use the contact form below. Include what you expected, what happened, and your platform if you choose to share it." },
] as const;

const sections = [
  { id: "faqs", label: "FAQs" },
  { id: "known-issues", label: "Known issues" },
  { id: "contact", label: "Contact" },
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
] as const;

const SupportCenter = () => {
  const { user } = useAuth();
  const { hash } = useLocation();
  const [query, setQuery] = useState("");
  const visibleFaqs = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return faqs.filter(({ question, answer }) =>
      words.every((word) => `${question} ${answer}`.toLocaleLowerCase().includes(word)),
    );
  }, [query]);

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView();
  }, [hash]);

  return (
    <div className="min-h-app-viewport bg-background text-foreground">
      <a href="#support-main" className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0 focus-visible:ring-2 focus-visible:ring-ring">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95">
        <div className="safe-top mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:px-6">
          <Link to="/" aria-label="Brack home" className="flex min-h-11 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring"><ThemeAwareLogo variant="full" size="h-8" /></Link>
          <nav aria-label="Support navigation" className="ml-auto flex items-center gap-3">
            <Link to={user ? "/settings" : "/"} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              {user ? "Settings" : "Home"}
            </Link>
            <ThemeToggle variant="inline" />
          </nav>
        </div>
      </header>

      <main id="support-main" className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">Brack support</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">How can we help?</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">Find a quick answer, check the support notes, or tell us what happened. We usually reply within 1–2 business days.</p>
        </div>

        <nav aria-label="On this page" className="mt-8 flex flex-wrap gap-2 border-b border-border pb-6">
          {sections.map(({ id, label }) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring">{label}</a>)}
        </nav>

        <div className="mt-10 grid min-w-0 gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
          <div className="min-w-0 space-y-14">
            <section id="faqs" className="scroll-mt-28" aria-labelledby="faqs-title">
              <h2 id="faqs-title" className="font-display text-2xl font-semibold">Frequently asked questions</h2>
              <div className="relative mt-5">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" aria-label="Search frequently asked questions" placeholder="Search FAQs" value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 pl-11" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground" role="status">{visibleFaqs.length} {visibleFaqs.length === 1 ? "answer" : "answers"} found</p>
              {visibleFaqs.length ? <div className="mt-4 divide-y divide-border border-y border-border">
                {visibleFaqs.map(({ question, answer }) => <details key={question} className="group py-4">
                  <summary className="cursor-pointer rounded-sm pr-5 font-medium leading-6 focus-visible:ring-2 focus-visible:ring-ring">{question}</summary>
                  <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">{answer}</p>
                </details>)}
              </div> : <p className="mt-5 text-sm text-muted-foreground">No answers match. Try another phrase or use the contact form.</p>}
            </section>

            <section id="known-issues" className="scroll-mt-28" aria-labelledby="known-title">
              <h2 id="known-title" className="font-display text-2xl font-semibold">Known issues</h2>
              <p className="mt-3 max-w-prose text-sm leading-7 text-muted-foreground">A live issue feed is not available yet. This section is a placeholder, not a current service-status report. If something is not working, send us a report with the form.</p>
            </section>

          </div>

          <section id="contact" className="min-w-0 scroll-mt-28" aria-label="Contact support">
            <SupportContact />
          </section>
        </div>
        <div className="mt-16 grid gap-12 border-t border-border pt-10 sm:grid-cols-2">
          <section id="terms" className="scroll-mt-28" aria-labelledby="terms-title">
            <h2 id="terms-title" className="font-display text-2xl font-semibold">Terms</h2>
            <p className="mt-3 max-w-prose text-sm leading-7 text-muted-foreground">Placeholder: Brack’s full terms have not been published on this page. This summary is not a legal agreement. For a question about account use or terms, contact support.</p>
          </section>

          <section id="privacy" className="scroll-mt-28" aria-labelledby="privacy-title">
            <h2 id="privacy-title" className="font-display text-2xl font-semibold">Privacy</h2>
            <p className="mt-3 max-w-prose text-sm leading-7 text-muted-foreground">Placeholder: the full privacy policy has not been published on this page. Please do not treat this as a complete policy. For privacy questions, use the contact form; signed-in readers can manage visibility in <Link className="underline underline-offset-2" to="/settings?section=privacy">Privacy Settings</Link>.</p>
          </section>
        </div>
      </main>
      <footer className="border-t border-border px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span>Brack support</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">{sections.map(({ id, label }) => <a key={id} href={`#${id}`} className="hover:text-foreground focus-visible:underline">{label}</a>)}</div>
        </div>
      </footer>
    </div>
  );
};

export default SupportCenter;
