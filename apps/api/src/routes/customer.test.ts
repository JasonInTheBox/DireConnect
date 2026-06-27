import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomerRouter } from "./customer.ts";

const mocks = {
  businessFindUnique: vi.fn(),
  customerFindMany: vi.fn(),
  customerCreate: vi.fn(),
  customerUpdateMany: vi.fn(),
  customerFindFirst: vi.fn(),
  customerDeleteMany: vi.fn(),
};

function createTestApp() {
  const fakeRequireAuth = async (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "jason@example.com",
    };

    next();
  };

  const mockDb = {
    business: {
      findUnique: mocks.businessFindUnique,
    },
    customer: {
      findMany: mocks.customerFindMany,
      create: mocks.customerCreate,
      updateMany: mocks.customerUpdateMany,
      findFirst: mocks.customerFindFirst,
      deleteMany: mocks.customerDeleteMany,
    },
  };

  const customerRouter = createCustomerRouter(mockDb as any, fakeRequireAuth);

  const app = express();

  app.use(express.json());

  app.use("/businesses/:businessId/customer", customerRouter);

  return app;
}

describe("customer routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it("GET /businesses/:businessId/customer returns customers for an owned business", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.customerFindMany.mockResolvedValue([
      {
        id: "customer-1",
        ownerId: "user-1",
        businessId: "business-1",
        firstName: "Alice",
        lastName: "Chen",
        email: "alice@example.com",
        phone: "1234567890",
        emailOptIn: true,
        smsOptIn: false,
        unsubscribedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const response = await request(createTestApp()).get(
      "/businesses/business-1/customer",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("customer-1");
    expect(response.body[0].businessId).toBe("business-1");

    expect(mocks.businessFindUnique).toHaveBeenCalledWith({
      where: {
        id_ownerId: {
          id: "business-1",
          ownerId: "user-1",
        },
      },
    });

    expect(mocks.customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: "business-1",
          ownerId: "user-1",
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    );
  });

  it("GET /businesses/:businessId/customer returns 404 when business is not owned", async () => {
    mocks.businessFindUnique.mockResolvedValue(null);

    const response = await request(createTestApp()).get(
      "/businesses/business-1/customer",
    );

    expect(response.status).toBe(404);
    expect(mocks.customerFindMany).not.toHaveBeenCalled();
  });

  it("POST /businesses/:businessId/customer creates a customer for an owned business", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.customerCreate.mockResolvedValue({
      id: "customer-1",
      ownerId: "user-1",
      businessId: "business-1",
      firstName: "Alice",
      lastName: "Chen",
      email: "alice@example.com",
      phone: "1234567890",
      emailOptIn: true,
      smsOptIn: false,
      unsubscribedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(createTestApp())
      .post("/businesses/business-1/customer")
      .send({
        firstName: "Alice",
        lastName: "Chen",
        email: "alice@example.com",
        phone: "1234567890",
        emailOptIn: true,
        smsOptIn: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("customer-1");
    expect(response.body.businessId).toBe("business-1");
    expect(response.body.ownerId).toBe("user-1");

    expect(mocks.customerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "user-1",
          businessId: "business-1",
          firstName: "Alice",
          lastName: "Chen",
          email: "alice@example.com",
          phone: "1234567890",
          emailOptIn: true,
          smsOptIn: false,
        }),
      }),
    );
  });

  it("POST /businesses/:businessId/customer rejects invalid customer data", async () => {
    const response = await request(createTestApp())
      .post("/businesses/business-1/customer")
      .send({
        email: "not-an-email",
        emailOptIn: true,
        smsOptIn: false,
      });

    expect(response.status).toBe(400);
    expect(mocks.customerCreate).not.toHaveBeenCalled();
  });



  it("PUT /businesses/:businessId/customer/:customerId updates a customer for an owned business", async () => {
  mocks.businessFindUnique.mockResolvedValue({
    id: "business-1",
    ownerId: "user-1",
    name: "Jason's Test Business",
  });

  mocks.customerUpdateMany.mockResolvedValue({
    count: 1,
  });

  mocks.customerFindFirst.mockResolvedValue({
    id: "customer-1",
    ownerId: "user-1",
    businessId: "business-1",
    firstName: "Alice Updated",
    lastName: "Chen",
    email: "alice.updated@example.com",
    phone: "1234567890",
    emailOptIn: true,
    smsOptIn: false,
    unsubscribedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  });

  const response = await request(createTestApp())
    .put("/businesses/business-1/customer/customer-1")
    .send({
      firstName: "Alice Updated",
      lastName: "Chen",
      email: "alice.updated@example.com",
      phone: "1234567890",
      emailOptIn: true,
      smsOptIn: false,
    });

  expect(response.status).toBe(200);
  expect(response.body.id).toBe("customer-1");
  expect(response.body.firstName).toBe("Alice Updated");
  expect(response.body.email).toBe("alice.updated@example.com");

  expect(mocks.customerUpdateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: "customer-1",
        businessId: "business-1",
        ownerId: "user-1",
      },
      data: expect.objectContaining({
        firstName: "Alice Updated",
        lastName: "Chen",
        email: "alice.updated@example.com",
        phone: "1234567890",
        emailOptIn: true,
        smsOptIn: false,
        unsubscribedAt: null,
      }),
    }),
  );

  expect(mocks.customerFindFirst).toHaveBeenCalledWith({
    where: {
      id: "customer-1",
      businessId: "business-1",
      ownerId: "user-1",
    },
  });
});



it("PUT /businesses/:businessId/customer/:customerId returns 404 when customer is not found", async () => {
  mocks.businessFindUnique.mockResolvedValue({
    id: "business-1",
    ownerId: "user-1",
    name: "Jason's Test Business",
  });

  mocks.customerUpdateMany.mockResolvedValue({
    count: 0,
  });

  const response = await request(createTestApp())
    .put("/businesses/business-1/customer/customer-1")
    .send({
      firstName: "Alice Updated",
      lastName: "Chen",
      email: "alice.updated@example.com",
      phone: "1234567890",
      emailOptIn: true,
      smsOptIn: false,
    });

  expect(response.status).toBe(404);
  expect(response.body.error).toBe("Customer not found");
  expect(mocks.customerFindFirst).not.toHaveBeenCalled();
});


it("DELETE /businesses/:businessId/customer/:customerId deletes a customer for an owned business", async () => {
  mocks.businessFindUnique.mockResolvedValue({
    id: "business-1",
    ownerId: "user-1",
    name: "Jason's Test Business",
  });

  mocks.customerDeleteMany.mockResolvedValue({
    count: 1,
  });

  const response = await request(createTestApp()).delete(
    "/businesses/business-1/customer/customer-1",
  );

  expect(response.status).toBe(204);

  expect(mocks.customerDeleteMany).toHaveBeenCalledWith({
    where: {
      id: "customer-1",
      businessId: "business-1",
      ownerId: "user-1",
    },
  });
});


it("DELETE /businesses/:businessId/customer/:customerId returns 404 when customer is not found", async () => {
  mocks.businessFindUnique.mockResolvedValue({
    id: "business-1",
    ownerId: "user-1",
    name: "Jason's Test Business",
  });

  mocks.customerDeleteMany.mockResolvedValue({
    count: 0,
  });

  const response = await request(createTestApp()).delete(
    "/businesses/business-1/customer/customer-1",
  );

  expect(response.status).toBe(404);
  expect(response.body.error).toBe("Customer not found");
});

});
