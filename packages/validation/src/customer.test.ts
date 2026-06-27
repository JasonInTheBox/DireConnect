import { describe, expect, it } from "vitest";
import { createCustomerSchema } from "./customer.js";

describe("createCustomerSchema", () => {
    it("accepts a valid customer", () => {
        const result = createCustomerSchema.safeParse({
            firstName: "Jason",
            lastName: "Liu",
            email: "jason@example.com",
            phone: "1234567890",
            emailOptIn: true,
            smsOptIn: false,
        });

        expect(result.success).toBe(true);
    });

    it("rejects an invalid email", () => {
        const result = createCustomerSchema.safeParse({
            firstName: "Jason",
            lastName: "Liu",
            email: "not-an-email",
            phone: "1234567890",
            emailOptIn: true,
            smsOptIn: false,
        });

        expect(result.success).toBe(false);
    });

    it("requires firstName", () => {
        const result = createCustomerSchema.safeParse({
            lastName: "Liu",
            email: "jason@example.com",
            phone: "1234567890",
            emailOptIn: true,
            smsOptIn: false,
        });

        expect(result.success).toBe(false);
    });
});
