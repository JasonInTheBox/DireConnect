import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AudienceDemo, LoyaltyDemo } from "@/components/landing/landing-demos";
import {
  LandingSignupNotice,
  NavAuthLinks,
  RedirectIfSignedIn,
} from "@/components/landing/landing-islands";
import { BrandMark } from "@/components/ui/brand";
import { buttonClasses } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { CAMPAIGN_LIMITS } from "@/lib/campaignLimits";
import { pageTitle } from "@/lib/pageTitle";

// Server component: the page is pre-rendered; auth-aware bits and demos are client islands.

const REPO = "https://github.com/JasonInTheBox/DireConnect";
const EMAIL = "junjie.6liu@gmail.com";
const TRY_MAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Trying DireConnect for my business")}`;
const HELP_MAIL = `mailto:${EMAIL}?subject=${encodeURIComponent("Helping build DireConnect")}`;
const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-8";
const BIG = "h-12 px-6 text-base";
const EYEBROW = "text-sm font-semibold uppercase tracking-wider text-accent";
const H2 = "mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl";
const LEAD = "mt-5 max-w-2xl text-lg text-muted sm:text-xl";
const GRADIENT_TEXT = "bg-gradient-to-r from-accent to-pop bg-clip-text text-transparent";

// Sky and coral glows over a faint grid, from theme tokens so dark mode follows.
const HERO_BG: CSSProperties = {
  backgroundImage: [
    "radial-gradient(55% 60% at 85% 15%, color-mix(in srgb, var(--sky) 30%, transparent), transparent 70%)",
    "radial-gradient(40% 50% at 5% 95%, color-mix(in srgb, var(--pop) 18%, transparent), transparent 70%)",
    "linear-gradient(color-mix(in srgb, var(--line) 70%, transparent) 1px, transparent 1px)",
    "linear-gradient(90deg, color-mix(in srgb, var(--line) 70%, transparent) 1px, transparent 1px)",
  ].join(","),
  backgroundSize: "auto, auto, 48px 48px, 48px 48px",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas">
      <title>{pageTitle("")}</title>
      <RedirectIfSignedIn />

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/80 backdrop-blur">
        <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
          <Link href="/" aria-label="DireConnect home">
            <BrandMark />
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-8 text-[15px] text-muted md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#try-it" className="hover:text-ink">Try it</a>
            <a href="#coming-next" className="hover:text-ink">Coming next</a>
            <a href="#get-involved" className="hover:text-ink">Get involved</a>
          </nav>
          <div className="flex items-center gap-2">
            <NavAuthLinks />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line" style={HERO_BG}>
          <div className={`${WRAP} grid min-h-[calc(100svh-4rem)] items-center gap-16 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-20`}>
            <div className="[animation:rise_600ms_ease-out_both]">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-sm text-muted shadow-sm">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pop opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pop" />
                </span>
                Free for small businesses · non-commercial
              </p>
              <h1 className="mt-7 text-5xl font-semibold tracking-tight text-ink sm:text-6xl xl:text-7xl">
                Turn one-time customers into <span className={GRADIENT_TEXT}>regulars</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
                No marketing team, no budget? DireConnect keeps the customers who opted in on one
                list, helps you send them a friendly email, and shows you who it reached. Loyalty
                rewards are next.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a href={TRY_MAIL} className={buttonClasses({ variant: "primary", className: `${BIG} shadow-float` })}>
                  Ask to try it free
                  <Icon name="chevronRight" />
                </a>
                <a href="#try-it" className={buttonClasses({ variant: "secondary", className: BIG })}>
                  Try the demo
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted">
                {["Opt-in customers only", "Unsubscribe link in every email", "Open source"].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="text-success"><Icon name="check" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroMock />
          </div>
        </section>

        <section aria-label="DireConnect in numbers" className="border-b border-line bg-surface">
          <dl className={`${WRAP} grid grid-cols-2 gap-y-10 py-14 lg:grid-cols-4`}>
            <Stat value="$0" label="to use while it is being tested" />
            <Stat value={CAMPAIGN_LIMITS.maxRecipientsPerCampaign} label="recipients per campaign during testing" />
            <Stat value={CAMPAIGN_LIMITS.maxEmailsPerRecipientPer24Hours} label="email per customer a day, so nobody is spammed" />
            <Stat value="4" label="guided steps from idea to sent" />
          </dl>
        </section>

        <section id="how-it-works" className="scroll-mt-16 border-b border-line py-28">
          <div className={WRAP}>
            <p className={EYEBROW}>How it works</p>
            <h2 className={H2}>From a customer list to customers coming back</h2>
            <p className={LEAD}>People who already bought from you are the easiest to bring back. Four steps, each one a screen in the app.</p>
            <ol className="mt-16 grid gap-6 md:grid-cols-2">
              <Step n={1} title="Set up your business" text="One login can run several businesses. Switch between them from the sidebar.">
                <div className="space-y-2">
                  <MockBusiness name="Corner Bakery" active />
                  <MockBusiness name="Riverside Florist" />
                  <p className="flex items-center gap-2 px-2 pt-1 text-sm text-accent"><Icon name="plus" /> Create business</p>
                </div>
              </Step>
              <Step n={2} title="Add customers who opted in" text="Record whether each customer agreed to hear from you. Search and edit them any time.">
                <MockRow name="Ada Lovelace" badge="Email opted in" />
                <MockRow name="Grace Hopper" badge="Email opted in" />
                <MockRow name="Alan Turing" badge="Not opted in" muted />
              </Step>
              <Step n={3} title="Write a campaign" text="A guided wizard: basics, recipients, message, review. Preview the email before it goes.">
                <div className="flex gap-1.5">
                  {["Basics", "Recipients", "Message", "Review"].map((label, i) => (
                    <span key={label} className={`flex-1 rounded-full py-1 text-center text-xs font-medium ${i < 3 ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"}`}>
                      {label}
                    </span>
                  ))}
                </div>
                <p className="mt-4 font-medium text-ink">Autumn menu is here</p>
                <p className="mt-1 text-sm text-muted">Pumpkin loaves and cardamom buns are back from Saturday.</p>
              </Step>
              <Step n={4} title="Send it and see who it reached" text="Send now or schedule it. Results and the delivery log refresh while messages go out.">
                <DeliveryBar />
              </Step>
            </ol>
          </div>
        </section>

        <section id="try-it" className="scroll-mt-16 border-b border-line bg-surface py-28">
          <div className={WRAP}>
            <p className={EYEBROW}>Try it</p>
            <h2 className={H2}>Only people who said yes get your email</h2>
            <p className={LEAD}>Flip a customer’s consent and watch the campaign’s audience change, just like the review step in the app.</p>
            <div className="mt-14">
              <AudienceDemo />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-b border-line py-28">
          <div className={WRAP}>
            <p className={EYEBROW}>Available today</p>
            <h2 className={H2}>Everything you need to send with confidence</h2>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon="users" title="Consent on every customer">Customers without consent or an email address are skipped, and the review step says why.</Feature>
              <Feature icon="search" title="Exact recipient preview">See the number and the names of everyone who will receive it before you send.</Feature>
              <Feature icon="clock" title="Send now or later">Queue a campaign right away, or pick a date and time that suits your customers.</Feature>
              <Feature icon="dashboard" title="Results at a glance">Sent, failed and pending counts on your dashboard, with a plain reason for every failure.</Feature>
              <Feature icon="x" title="One-click unsubscribe">Every email carries a link that removes the customer from all future campaigns.</Feature>
              <Feature icon="building" title="Several businesses, one login">Keep each business’s customers and campaigns apart, each with its own dashboard.</Feature>
            </div>
          </div>
        </section>

        <section id="coming-next" className="scroll-mt-16 border-b border-line bg-surface py-28">
          <div className={`${WRAP} grid items-center gap-16 lg:grid-cols-[1fr_0.9fr]`}>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-pop-strong">Coming next · not released yet</p>
              <h2 className={H2}>Give customers a reason to come back</h2>
              <p className={LEAD}>Planned features that turn a mailing list into a loyalty program, and bring new faces in through word of mouth.</p>
              <ul className="mt-10 space-y-6">
                <Planned icon="check" title="Loyalty rewards you design">Set your own points and rewards for your business, like a free coffee after five visits.</Planned>
                <Planned icon="user" title="A rewards portal for customers">Customers check their own points and rewards, without calling you to ask.</Planned>
                <Planned icon="send" title="SMS notifications, once funded">Text messages cost money to send, so SMS waits until the project has funding.</Planned>
              </ul>
            </div>
            <div className="mx-auto w-full max-w-md">
              <LoyaltyDemo />
            </div>
          </div>
        </section>

        <section id="get-involved" className="scroll-mt-16 py-28">
          <div className={WRAP}>
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0b6fbf] to-[#083d6b] px-6 py-14 text-white sm:px-14 sm:py-20">
              <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#38bdf8]/40 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-[#f2643d]/30 blur-3xl" />
              <div className="relative grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start">
                <div>
                  <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">A non-commercial project, looking for people</h2>
                  <p className="mt-5 max-w-xl text-lg text-white/90">
                    DireConnect is a personal project. It is free, it is not for commercial use, and
                    accounts are opened by invitation while it is being tested.
                  </p>
                  <p className="mt-6 text-lg">
                    Email{" "}
                    <a href={`mailto:${EMAIL}`} className="font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white">
                      {EMAIL}
                    </a>
                  </p>
                  <div className="mt-6 max-w-xl text-ink">
                    <LandingSignupNotice />
                  </div>
                </div>
                <div className="grid gap-4">
                  <Card title="Small business owners: try it with your customers">
                    <p>Tell us about your business and we will set up a free account for testing.</p>
                    <a href={TRY_MAIL} className={buttonClasses({ variant: "primary", className: `mt-5 ${BIG}` })}>
                      Ask to try it free
                    </a>
                  </Card>
                  <Card title="Developers and designers: help build it">
                    <p>Built with Next.js, Express, Prisma, BullMQ, Supabase and Resend. Loyalty rewards are the next big piece.</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <a href={HELP_MAIL} className={buttonClasses({ variant: "primary", className: BIG })}>
                        Email to collaborate
                      </a>
                      <a href={REPO} className={buttonClasses({ variant: "secondary", className: BIG })}>
                        See the code on GitHub
                      </a>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-3 py-10 text-[15px] text-muted`}>
          <p>DireConnect · a non-commercial project</p>
          <div className="flex gap-6">
            <a href={`mailto:${EMAIL}`} className="hover:text-ink hover:underline">Contact</a>
            <a href={REPO} className="hover:text-ink hover:underline">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col-reverse px-2">
      <dt className="mt-2 max-w-[16rem] text-[15px] text-muted">{label}</dt>
      <dd className={`text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl ${GRADIENT_TEXT} w-fit`}>{value}</dd>
    </div>
  );
}

function Step({ n, title, text, children }: { n: number; title: string; text: string; children: ReactNode }) {
  return (
    <li className="group rounded-[16px] border border-line bg-surface p-7 shadow-card transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float">
      <div aria-hidden="true" className="min-h-40 rounded-container border border-line bg-canvas p-5">
        {children}
      </div>
      <div className="mt-7 flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky to-accent text-base font-semibold text-white transition-transform group-hover:scale-110">
          {n}
        </span>
        <div>
          <h3 className="text-xl font-semibold text-ink">{title}</h3>
          <p className="mt-2 text-base text-muted">{text}</p>
        </div>
      </div>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="group rounded-[16px] border border-line bg-surface p-7 shadow-card transition duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float">
      <span className="flex h-12 w-12 items-center justify-center rounded-container bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink [&_svg]:h-6 [&_svg]:w-6">
        <Icon name={icon} />
      </span>
      <h3 className="mt-6 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base text-muted">{children}</p>
    </div>
  );
}

function Planned({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-container bg-pop-soft text-pop-strong">
        <Icon name={icon} />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-base text-muted">{children}</p>
      </div>
    </li>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[16px] bg-surface p-7 text-base text-muted shadow-float">
      <h3 className="mb-2 text-xl font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function MockBusiness({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-control px-2 py-1.5 ${active ? "bg-accent-soft" : ""}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-sm font-semibold text-accent-ink">
        {name[0]}
      </span>
      <span className={`font-medium ${active ? "text-accent" : "text-ink"}`}>{name}</span>
    </div>
  );
}

function MockRow({ name, badge, muted = false }: { name: string; badge: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line py-2.5 last:border-0">
      <span className="text-ink">{name}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${muted ? "bg-sunken text-muted" : "bg-success-soft text-success"}`}>
        {badge}
      </span>
    </div>
  );
}

function DeliveryBar() {
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
        <span className="origin-left bg-success [animation:fill_1.2s_ease-out_both]" style={{ flexGrow: 7 }} />
        <span className="bg-danger" style={{ flexGrow: 1 }} />
        <span className="bg-warning" style={{ flexGrow: 2 }} />
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        {[["Sent", 7], ["Failed", 1], ["Pending", 2]].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const LOG = [
  { name: "Ada Lovelace", status: "Sent", tone: "bg-success-soft text-success" },
  { name: "Grace Hopper", status: "Sent", tone: "bg-success-soft text-success" },
  { name: "Katherine Johnson", status: "Pending", tone: "bg-warning-soft text-warning" },
  { name: "Mary Jackson", status: "Failed", tone: "bg-danger-soft text-danger" },
];

/** A static copy of a campaign's results screen, drawn with the app's own tokens. */
function HeroMock() {
  return (
    <div
      role="img"
      aria-label="The DireConnect results screen for the Autumn menu campaign: 7 sent, 1 failed, 2 pending"
      className="relative [animation:rise_700ms_150ms_ease-out_both]"
    >
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface shadow-float">
        <div className="flex items-center gap-1.5 border-b border-line bg-sunken px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-danger/70" />
          <span className="h-3 w-3 rounded-full bg-warning/70" />
          <span className="h-3 w-3 rounded-full bg-success/70" />
          <span className="ml-3 rounded-control bg-surface px-3 py-0.5 text-xs text-muted">direconnect · Campaigns</span>
        </div>
        <div className="grid sm:grid-cols-[11rem_1fr]">
          <div className="hidden border-r border-line p-4 text-sm sm:block">
            <div className="flex items-center gap-2 rounded-control bg-canvas px-2 py-2 font-medium text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs text-accent-ink">C</span>
              Corner Bakery
            </div>
            <p className="mt-4 flex items-center gap-2 px-2 py-1.5 text-muted"><Icon name="dashboard" /> Dashboard</p>
            <p className="flex items-center gap-2 px-2 py-1.5 text-muted"><Icon name="users" /> Customers</p>
            <p className="flex items-center gap-2 rounded-control bg-accent-soft px-2 py-1.5 font-medium text-accent"><Icon name="send" /> Campaigns</p>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Campaign</p>
                <p className="text-xl font-semibold text-ink">Autumn menu is here</p>
              </div>
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Sent</span>
            </div>
            <div className="mt-6 rounded-container border border-line p-4">
              <DeliveryBar />
            </div>
            <ul className="mt-5 divide-y divide-line text-sm">
              {LOG.map((row) => (
                <li key={row.name} className="flex items-center justify-between py-2.5">
                  <span className="text-ink">{row.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.tone}`}>{row.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="absolute -left-10 bottom-16 hidden w-60 rounded-container border border-line bg-surface p-4 shadow-float [animation:float_6s_ease-in-out_infinite] lg:block">
        <p className="text-sm text-muted">Review and send</p>
        <p className="mt-1 text-ink"><span className="text-3xl font-semibold text-accent tabular-nums">10</span> customers will receive this</p>
        <p className="mt-1 text-xs text-muted">1 skipped: hasn’t agreed to receive emails</p>
      </div>
      <div className="absolute -top-6 right-6 hidden items-center gap-3 rounded-container border border-line bg-surface px-4 py-3 shadow-float [animation:float_7s_1s_ease-in-out_infinite] lg:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pop-soft text-pop-strong"><Icon name="clock" /></span>
        <span className="text-sm text-ink">Refreshing the delivery log…</span>
      </div>
    </div>
  );
}
