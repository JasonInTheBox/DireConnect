import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validate } from "./validate.js";

const testSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

function createTestApp() {
  const app = express();

  app.use(express.json());

  app.post("/test", validate(testSchema), (req, res) => {
    res.status(201).json({
      ok: true,
      body: req.body,
    });
  });

  return app;
}

describe("validate middleware", () => {
  it("allows valid request bodies", async () => {
    const app = createTestApp();

    const response = await request(app).post("/test").send({
      name: "Jason",
      email: "jason@example.com",
    });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.body.name).toBe("Jason");
    expect(response.body.body.email).toBe("jason@example.com");
  });

  it("rejects invalid request bodies", async () => {
    const app = createTestApp();

    const response = await request(app).post("/test").send({
      name: "",
      email: "not-an-email",
    });

    expect(response.status).toBe(400);
  });

  it("rejects missing required fields", async () => {
    const app = createTestApp();

    const response = await request(app).post("/test").send({
      email: "jason@example.com",
    });

    expect(response.status).toBe(400);
  });
});
