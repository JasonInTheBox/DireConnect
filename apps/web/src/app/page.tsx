import Link from "next/link";
import type { ReactNode } from "react";
import {
  LandingSignupNotice,
  NavAuthLinks,
  RedirectIfSignedIn,
} from "@/components/landing/landing-islands";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { pageTitle } from "@/lib/pageTitle";

// Server component: the page is pre-rendered; only the auth-aware bits are client islands.

const REPO = "https://github.com/JasonInTheBox/DireConnect";
const CONTACT = `${REPO}/issues/new`;
const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas">
      <title>{pageTitle("")}</title>
      <RedirectIfSignedIn />

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" className="text-base font-semibold tracking-tight text-ink">
            DireConnect
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#how-it-works" className="hover:text-ink">
              How it works
            </a>
            <a href="#features" className="hover:text-ink">
              Features
            </a>
            <a href="#get-involved" className="hover:text-ink">
              Get involved
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <NavAuthLinks />
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-line">
          <div
            className={`${WRAP} grid min-h-[calc(100svh-4rem)] items-center gap-12 py-16 lg:grid-cols-[1fr_1.1fr]`}
          >
            <div>
              <p className="inline-flex items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1 text-[13px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                Free and non-commercial · up to 10 recipients per campaign
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                Customer lists and email campaigns for small businesses
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted">
                Keep the people who asked to hear from you in one place, write an email, check
                exactly who will receive it, and see what was delivered.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={CONTACT} className={buttonClasses({ variant: "primary" })}>
                  Ask to try DireConnect
                </a>
                <a href="#how-it-works" className={buttonClasses({ variant: "secondary" })}>
                  See how it works
                </a>
              </div>
            </div>
            <ReviewScreenMock />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-b border-line py-24">
          <div className={WRAP}>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">How DireConnect works</h2>
            <p className="mt-3 max-w-2xl text-base text-muted">
              Three steps, from a customer list to a delivered campaign.
            </p>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              <Step n={1} title="Add customers who opted in" text="Each customer records whether they agreed to promotional email.">
                <MockRow name="Ada Lovelace" badge="Email opted in" />
                <MockRow name="Grace Hopper" badge="Email opted in" />
                <MockRow name="Alan Turing" badge="Not opted in" muted />
              </Step>
              <Step n={2} title="Write and preview the email" text="The campaign name becomes the subject; you see the email before it goes out.">
                <p className="text-[13px] font-medium text-ink">Autumn menu is here</p>
                <div className="mt-2 space-y-1.5">
                  <span className="block h-2 w-full rounded-full bg-line-strong" />
                  <span className="block h-2 w-5/6 rounded-full bg-line-strong" />
                  <span className="block h-2 w-2/3 rounded-full bg-line-strong" />
                </div>
              </Step>
              <Step n={3} title="Send and track delivery" text="Send now or schedule it, then follow every message in the delivery log.">
                <DeliveryBar />
              </Step>
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-b border-line py-24">
          <div className={WRAP}>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">Built around consent</h2>
            <p className="mt-3 max-w-2xl text-base text-muted">
              DireConnect only emails people who asked for it, and keeps sending small on purpose.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              <Feature icon="check" title="Sends only to opted-in customers">
                Customers without consent or an email address are skipped, and you see why.
              </Feature>
              <Feature icon="x" title="Adds an unsubscribe link to every email">
                One click removes a customer from every future campaign.
              </Feature>
              <Feature icon="clock" title="Caps sending while in early access">
                Up to 10 recipients a campaign and one campaign email per customer a day.
              </Feature>
              <Feature icon="search" title="Logs every delivery and failure">
                Each recipient gets a status, a send time and a plain reason when something fails.
              </Feature>
            </div>
          </div>
        </section>

        <section id="get-involved" className="scroll-mt-16 py-24">
          <div className={`${WRAP} grid gap-12 lg:grid-cols-2`}>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-ink">
                A non-commercial project
              </h2>
              <p className="mt-4 max-w-xl text-base text-muted">
                DireConnect is a personal project. It is free, it is not for commercial use, and
                new accounts are opened by invitation while it is being tested.
              </p>
              <div className="mt-6 max-w-xl">
                <LandingSignupNotice />
              </div>
            </div>
            <div className="grid gap-4">
              <Card title="Small businesses: try it with your customers">
                <p>Tell us about your business and we will set up an account for testing.</p>
                <a href={CONTACT} className={buttonClasses({ variant: "primary", className: "mt-4" })}>
                  Ask to try DireConnect
                </a>
              </Card>
              <Card title="Developers and designers: help build it">
                <p>Built with Next.js, Express, Prisma, BullMQ, Supabase and Resend.</p>
                <a href={REPO} className={buttonClasses({ variant: "secondary", className: "mt-4" })}>
                  See the code on GitHub
                </a>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-3 py-8 text-[13px] text-muted`}>
          <p>DireConnect · a non-commercial project</p>
          <a href={REPO} className="hover:text-ink hover:underline">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="rounded-container border border-line bg-surface p-5 transition-transform duration-150 hover:-translate-y-0.5">
      <div aria-hidden="true" className="rounded-control border border-line bg-canvas p-3">
        {children}
      </div>
      <p className="mt-5 text-[13px] font-medium text-accent">Step {n}</p>
      <h3 className="mt-1 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-container border border-line bg-surface p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
        <Icon name={icon} />
      </span>
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-container border border-line bg-surface p-6 text-sm text-muted">
      <h3 className="mb-2 text-base font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function MockRow({ name, badge, muted = false }: { name: string; badge: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-[13px]">
      <span className="text-ink">{name}</span>
      <span
        className={`rounded-control px-1.5 py-0.5 text-xs ${muted ? "bg-sunken text-muted" : "bg-success-soft text-success"}`}
      >
        {badge}
      </span>
    </div>
  );
}

function DeliveryBar() {
  return (
    <div>
      <div className="flex h-3 gap-0.5">
        <span className="rounded-l-[4px] bg-success" style={{ flexGrow: 7 }} />
        <span className="bg-danger" style={{ flexGrow: 1 }} />
        <span className="rounded-r-[4px] bg-warning" style={{ flexGrow: 2 }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-1 text-xs">
        <div><dt className="text-muted">Sent</dt><dd className="font-semibold text-ink">7</dd></div>
        <div><dt className="text-muted">Failed</dt><dd className="font-semibold text-ink">1</dd></div>
        <div><dt className="text-muted">Pending</dt><dd className="font-semibold text-ink">2</dd></div>
      </dl>
    </div>
  );
}

/** A static copy of the real "Review and send" step, drawn with the app's own tokens. */
function ReviewScreenMock() {
  return (
    <div
      role="img"
      aria-label="The DireConnect review screen: 2 customers will receive the Autumn menu campaign"
      className="overflow-hidden rounded-container border border-line bg-surface shadow-float"
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-sunken px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
      </div>
      <div className="grid grid-cols-[9rem_1fr]">
        <div className="hidden border-r border-line p-3 text-[13px] sm:block">
          <p className="rounded-control bg-canvas px-2 py-1.5 font-medium text-ink">Corner Bakery</p>
          <p className="mt-3 px-2 py-1 text-muted">Dashboard</p>
          <p className="px-2 py-1 text-muted">Customers</p>
          <p className="rounded-control bg-accent-soft px-2 py-1 font-medium text-accent">Campaigns</p>
        </div>
        <div className="col-span-2 p-5 sm:col-span-1">
          <p className="text-[13px] text-muted">Step 4 of 4</p>
          <p className="text-base font-semibold text-ink">Review and send</p>
          <div className="mt-4 rounded-control border border-line p-3">
            <p className="text-xs text-muted">Subject</p>
            <p className="text-sm font-medium text-ink">Autumn menu is here</p>
            <p className="mt-2 text-xs text-muted">Pumpkin loaves and cardamom buns are back from Saturday.</p>
          </div>
          <p className="mt-4 text-sm text-ink">
            <span className="text-2xl font-semibold">2</span> customers will receive this campaign
          </p>
          <p className="text-xs text-muted">1 skipped: hasn’t agreed to receive emails</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Goes out right away</span>
            <span className={buttonClasses({ variant: "primary", size: "sm" })}>Send now</span>
          </div>
        </div>
      </div>
    </div>
  );
}
