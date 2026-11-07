import { Router } from "express";
import { prisma } from "@direconnect/db";

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1b2533;line-height:1.5">
<h1 style="font-size:1.5rem">${title}</h1>${body}</body></html>`;
}

export function createUnsubscribeRouter(db: typeof prisma = prisma) {
  const router = Router();

  // GET never changes anything: email security scanners open links before people do.
  router.get("/:token", async (req, res) => {
    const customer = await db.customer.findUnique({
      where: { unsubscribeToken: req.params.token },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).send(page("Link not found", "<p>This unsubscribe link is not valid.</p>"));
    }

    res.send(
      page(
        "Unsubscribe from these emails?",
        `<p>You will stop getting promotions from this business.</p>
<form method="post"><button type="submit" style="font:inherit;padding:.6rem 1.2rem;border-radius:8px;border:0;background:#2a70a8;color:#fff;cursor:pointer">Unsubscribe</button></form>`,
      ),
    );
  });

  // The confirm button and inbox one-click unsubscribe (RFC 8058) both POST here.
  router.post("/:token", async (req, res) => {
    const { count } = await db.customer.updateMany({
      where: { unsubscribeToken: req.params.token },
      data: { emailOptIn: false, smsOptIn: false, unsubscribedAt: new Date() },
    });

    if (count === 0) {
      return res.status(404).send(page("Link not found", "<p>This unsubscribe link is not valid.</p>"));
    }

    res.send(page("You are unsubscribed", "<p>You will not get further promotions from this business.</p>"));
  });

  return router;
}

export const unsubscribeRouter = createUnsubscribeRouter();
