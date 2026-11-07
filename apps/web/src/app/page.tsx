import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AudienceDemo, LoyaltyDemo, StepsShowcase } from "@/components/landing/landing-demos";
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
const H2 = "mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl";
const LEAD = "mt-5 max-w-2xl text-lg text-muted sm:text-xl";
const LINK = "underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-accent";

// The same soft light from above as the sign-in pages.
const WASH: CSSProperties = {
  backgroundImage: [
    "radial-gradient(60% 70% at 75% 10%, color-mix(in srgb, var(--sky) 55%, transparent), transparent 70%)",
    "radial-gradient(50% 60% at 0% 100%, var(--accent-soft), transparent 75%)",
  ].join(","),
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 56rem",
};

const STEPS = [
  {
    title: "Set up your business",
    text: "One login can run several businesses, each with its own dashboard.",
    scene: (
      <div className="space-y-2">
        <p className="mb-4 text-sm text-muted">Your businesses</p>
        <SceneBusiness name="Corner Bakery" detail="42 customers" active />
        <SceneBusiness name="Riverside Florist" detail="18 customers" />
        <p className="flex items-center gap-2 px-3 pt-2 font-medium text-accent">
          <Icon name="plus" /> Create business
        </p>
      </div>
    ),
  },
  {
    title: "Add customers who opted in",
    text: "Record whether each customer agreed to hear from you.",
    scene: (
      <div>
        <div className="flex items-center gap-2 rounded-control border border-line-strong px-3 py-2.5 text-muted">
          <Icon name="search" /> Search by name, email or phone
        </div>
        <div className="mt-3 divide-y divide-line">
          <SceneCustomer name="Ada Lovelace" email="ada@example.com" optedIn />
          <SceneCustomer name="Grace Hopper" email="grace@example.com" optedIn />
          <SceneCustomer name="Alan Turing" email="alan@example.com" />
          <SceneCustomer name="Katherine Johnson" email="katherine@example.com" optedIn />
        </div>
      </div>
    ),
  },
  {
    title: "Write a campaign",
    text: "A guided wizard: basics, recipients, message, review.",
    scene: (
      <div>
        <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {["Basics", "Recipients", "Message", "Review and send"].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${i === 2 ? "bg-accent text-accent-ink" : "bg-sunken text-muted"}`}>{i + 1}</span>
              <span className={i === 2 ? "font-medium text-ink" : "text-muted"}>{label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm font-medium text-ink">Subject</p>
        <p className="mt-1.5 rounded-control border border-line-strong px-3 py-2.5 text-ink">Autumn menu is here</p>
        <p className="mt-4 text-sm font-medium text-ink">Message</p>
        <p className="mt-1.5 rounded-control border border-line-strong px-3 py-2.5 text-ink">
          Pumpkin loaves and cardamom buns are back from Saturday. See you soon!
        </p>
      </div>
    ),
  },
  {
    title: "Send it and see who it reached",
    text: "Send now or schedule it, then follow every delivery.",
    scene: (
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-semibold text-ink">Autumn menu is here</p>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Sent</span>
        </div>
        <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full">
          <span className="origin-left rounded-full bg-success [animation:fill_1.2s_ease-out_both]" style={{ flexGrow: 7 }} />
          <span className="rounded-full bg-danger" style={{ flexGrow: 1 }} />
          <span className="rounded-full bg-warning" style={{ flexGrow: 2 }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[["Sent", 7], ["Failed", 1], ["Pending", 2]].map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-2xl font-semibold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-5 divide-y divide-line text-sm">
          <SceneLog name="Ada Lovelace" status="Sent" tone="bg-success-soft text-success" />
          <SceneLog name="Katherine Johnson" status="Pending" tone="bg-warning-soft text-warning" />
          <SceneLog name="Mary Jackson" status="Failed" tone="bg-danger-soft text-danger" />
        </ul>
      </div>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas" style={WASH}>
      <title>{pageTitle("")}</title>
      <RedirectIfSignedIn />

      <header className="sticky top-0 z-20 border-b border-transparent bg-canvas/70 backdrop-blur-md">
          <div className={`${WRAP} flex h-16 items-center justify-between gap-4`}>
            <Link href="/" aria-label="DireConnect home" className="rounded-control">
              <BrandMark />
            </Link>
            <nav aria-label="Site" className="hidden items-center gap-8 text-[15px] text-muted md:flex">
              <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
              <a href="#features" className="transition-colors hover:text-ink">Features</a>
              <a href="#coming-next" className="transition-colors hover:text-ink">Coming next</a>
              <a href="#get-involved" className="transition-colors hover:text-ink">Get involved</a>
            </nav>
            <div className="flex items-center gap-2">
              <NavAuthLinks />
            </div>
          </div>
        </header>

        <section className={`${WRAP} grid min-h-[calc(100svh-4rem)] items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20`}>
          <div className="min-w-0">
            <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight text-ink [overflow-wrap:break-word] sm:text-6xl xl:text-7xl">
              Turn one-time customers into regulars
            </h1>
            <p className="mt-6 max-w-lg text-xl text-muted">
              Email the customers who opted in, then see who it reached.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={TRY_MAIL} className={buttonClasses({ variant: "primary", className: `${BIG} shadow-float` })}>
                Ask to try it free
              </a>
              <a href="#how-it-works" className={buttonClasses({ variant: "secondary", className: BIG })}>
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm text-muted">Free and non-commercial while it is being tested.</p>
          </div>
          <div className="min-w-0">
            <AudienceDemo />
            <p className="mt-3 text-center text-sm text-muted">Flip a switch: only customers who said yes get the email.</p>
          </div>
        </section>

      <main>
        <section id="how-it-works" className="scroll-mt-16 border-y border-line bg-sunken/60 py-28">
          <div className={WRAP}>
            <h2 className={H2}>From a customer list to customers coming back</h2>
            <p className={LEAD}>Four steps, each one a screen in the app.</p>
            <div className="mt-14">
              <StepsShowcase steps={STEPS} />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 py-28">
          <div className={`${WRAP} grid gap-14 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]`}>
            <div>
              <h2 className={H2}>Careful by design</h2>
              <p className={LEAD}>
                Everything a small business needs to send a campaign without spamming anyone.
              </p>
            </div>
            <ul className="grid gap-x-12 sm:grid-cols-2">
              <Feature icon="users" title="Consent on every customer">Customers without consent or an email address are skipped, and the review step says why.</Feature>
              <Feature icon="search" title="Exact recipient preview">See the number and the names of everyone who will receive it before you send.</Feature>
              <Feature icon="clock" title="Send now or later">Queue a campaign right away, or pick a date and time that suits your customers.</Feature>
              <Feature icon="dashboard" title="Results at a glance">Sent, failed and pending counts, with a plain reason for every failure.</Feature>
              <Feature icon="x" title="One-click unsubscribe">Every email carries a link that removes the customer from all future campaigns.</Feature>
              <Feature icon="building" title="Several businesses, one login">Keep each business’s customers and campaigns apart.</Feature>
              <Feature icon="check" title="Small on purpose">
                While testing: up to {CAMPAIGN_LIMITS.maxRecipientsPerCampaign} recipients a campaign and{" "}
                {CAMPAIGN_LIMITS.maxEmailsPerRecipientPer24Hours} email per customer a day.
              </Feature>
              <Feature icon="user" title="Your account, your data">Reset your password and manage your sign-in from the account page.</Feature>
            </ul>
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

        <section id="get-involved" className="scroll-mt-16 bg-accent-soft py-28">
          <div className={`${WRAP} grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center`}>
            <div>
              <h2 className={H2}>A free project, looking for people</h2>
              <p className={LEAD}>
                DireConnect is a personal, non-commercial project. Accounts are opened by
                invitation while it is being tested.
              </p>
              <p className="mt-6 text-lg text-ink">
                Write to <a href={`mailto:${EMAIL}`} className={`font-semibold ${LINK}`}>{EMAIL}</a>
              </p>
              <div className="mt-6 max-w-xl">
                <LandingSignupNotice />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Card title="Run a small business?" text="Tell us about it and we will set up a free account to test with your customers.">
                <a href={TRY_MAIL} className={buttonClasses({ variant: "primary", className: BIG })}>
                  Ask to try it free
                </a>
              </Card>
              <Card title="Build or design?" text="Next.js, Express, Prisma, BullMQ, Supabase and Resend. Loyalty rewards are the next big piece.">
                <a href={HELP_MAIL} className={buttonClasses({ variant: "primary", className: BIG })}>
                  Email to collaborate
                </a>
                <a href={REPO} className={`mt-3 block text-muted ${LINK}`}>
                  Read the code on GitHub
                </a>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className={`${WRAP} grid gap-10 py-14 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]`}>
          <div>
            <BrandMark />
            <p className="mt-4 max-w-xs text-muted">Customer lists and careful email campaigns for small businesses.</p>
          </div>
          <FooterLinks title="Product" links={[["How it works", "#how-it-works"], ["Features", "#features"], ["Coming next", "#coming-next"]]} />
          <FooterLinks title="Project" links={[["Contact", `mailto:${EMAIL}`], ["GitHub", REPO], ["Get involved", "#get-involved"]]} />
        </div>
        <div className={`${WRAP} border-t border-line py-6 text-sm text-muted`}>
          DireConnect is a non-commercial project.
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 border-t border-line py-6">
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
        <Icon name={icon} />
      </span>
      <div>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-base text-muted">{children}</p>
      </div>
    </li>
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

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-container bg-surface p-7 shadow-card">
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <p className="mb-6 mt-2 flex-1 text-base text-muted">{text}</p>
      <div>{children}</div>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="text-muted transition-colors hover:text-ink">{label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SceneBusiness({ name, detail, active = false }: { name: string; detail: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-control px-3 py-3 ${active ? "bg-accent-soft" : "border border-line"}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent font-semibold text-accent-ink">{name[0]}</span>
      <span>
        <span className={`block font-semibold ${active ? "text-accent" : "text-ink"}`}>{name}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </div>
  );
}

function SceneCustomer({ name, email, optedIn = false }: { name: string; email: string; optedIn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0">
        <span className="block font-medium text-ink">{name}</span>
        <span className="block truncate text-sm text-muted">{email}</span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${optedIn ? "bg-success-soft text-success" : "bg-sunken text-muted"}`}>
        {optedIn ? "Email opted in" : "Not opted in"}
      </span>
    </div>
  );
}

function SceneLog({ name, status, tone }: { name: string; status: string; tone: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-ink">{name}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
    </li>
  );
}
