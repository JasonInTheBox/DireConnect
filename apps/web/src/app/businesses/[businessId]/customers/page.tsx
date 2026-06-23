"use client"

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type Customer = {
    id: string;
    ownerId: string;
    businessId: string;
    firstName: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    emailOptIn: boolean;
    smsOptIn: boolean;
    unsubscribedAt?: string | null;
};

type PageProps = {
    params: Promise<{
        businessId: string;
    }>;
};

export default function BusinessCustomersPage({ params }: PageProps) {
    const { businessId } = use(params);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    const [emailOptIn, setEmailOptIn] = useState(true);
    const [smsOptIn, setSmsOptIn] = useState(false);

    async function getAuthHeaders() {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
        };
    }


    async function fetchCustomers() {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            window.location.href = "/login";
            return;
        }

        const res = await fetch(apiUrl(`/api/businesses/${businessId}/customers`), {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            alert(errorData?.error || `Failed to fetch customers. Status: ${res.status}`);
            return;
        }

        const data = await res.json();
        setCustomers(data);
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    function resetForm() {
      setEditingCustomerId(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setEmailOptIn(true);
      setSmsOptIn(false);
    }

  function handleEdit(customer: Customer) {
    setEditingCustomerId(customer.id);
    setFirstName(customer.firstName);
    setLastName(customer.lastName || "");
    setEmail(customer.email || "");
    setPhone(customer.phone || "");
    setEmailOptIn(customer.emailOptIn ?? true);
    setSmsOptIn(customer.smsOptIn ?? false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const customerData = {
      firstName,
      lastName,
      email,
      phone,
      emailOptIn,
      smsOptIn,
    };

    const url = editingCustomerId
      ? apiUrl(`/api/businesses/${businessId}/customers/${editingCustomerId}`)
      : apiUrl(`/api/businesses/${businessId}/customers`);

    const method = editingCustomerId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(customerData),
    });

    if (!res.ok) {
      alert(editingCustomerId ? "Failed to update customer" : "Failed to create customer");
      return;
    }

    resetForm();
    fetchCustomers();
  }

  async function handleDelete(id: string) {
    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/customers/${id}`),
      {
        method: "DELETE",
        headers: await getAuthHeaders(),
      }
    );

    if (!res.ok) {
      alert("Failed to delete customer");
      return;
    }

    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Business Customers
            </h1>
            <p className="mt-2 text-gray-400">
              Manage customers for this selected business.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            Log out
          </button>
        </div>

        <div className="mb-6">
          <Link
            href="/businesses"
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back to Businesses
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            {editingCustomerId ? "Edit Customer" : "Add Customer"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={emailOptIn}
                  onChange={(e) => setEmailOptIn(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                />
                Email opt-in
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={smsOptIn}
                  onChange={(e) => setSmsOptIn(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                />
                SMS opt-in
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                type="submit"
              >
                {editingCustomerId ? "Update Customer" : "Add Customer"}
              </button>

              {editingCustomerId && (
                <button
                  className="rounded-lg bg-gray-800 px-4 py-2 font-semibold text-gray-100 hover:bg-gray-700"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Customers</h2>
            <span className="text-sm text-gray-400">
              {customers.length} total
            </span>
          </div>

          {customers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-8 text-center text-gray-400">
              No customers yet. Add your first customer above.
            </div>
          ) : (
            <ul className="space-y-4">
              {customers.map((customer) => (
                <li
                  key={customer.id}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-sm"
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {customer.firstName} {customer.lastName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {customer.email || "No email"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {customer.phone || "No phone"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={
                            customer.emailOptIn
                              ? "rounded-full bg-green-950 px-3 py-1 text-xs font-semibold text-green-300"
                              : "rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300"
                          }
                        >
                          Email: {customer.emailOptIn ? "Opted in" : "Opted out"}
                        </span>

                        <span
                          className={
                            customer.smsOptIn
                              ? "rounded-full bg-green-950 px-3 py-1 text-xs font-semibold text-green-300"
                              : "rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300"
                          }
                        >
                          SMS: {customer.smsOptIn ? "Opted in" : "Opted out"}
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                      Customer
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700"
                      onClick={() => handleEdit(customer)}
                    >
                      Edit
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      onClick={() => handleDelete(customer.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
