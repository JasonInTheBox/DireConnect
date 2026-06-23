"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";
import Link from "next/link";

type Business = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    };
  }

  async function fetchBusinesses() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(apiUrl("/api/businesses"), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!res.ok) {
      alert("Failed to fetch businesses");
      return;
    }

    const data = await res.json();
    setBusinesses(data);
  }

  useEffect(() => {
    fetchBusinesses();
  }, []);

  function resetForm() {
    setEditingBusinessId(null);
    setName("");
    setDescription("");
    setEmail("");
    setPhone("");
    setWebsite("");
  }

  function handleEdit(business: Business) {
    setEditingBusinessId(business.id);
    setName(business.name);
    setDescription(business.description || "");
    setEmail(business.email || "");
    setPhone(business.phone || "");
    setWebsite(business.website || "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const businessData = {
      name,
      description,
      email,
      phone,
      website,
    };

    const url = editingBusinessId
      ? apiUrl(`/api/businesses/${editingBusinessId}`)
      : apiUrl("/api/businesses");

    const method = editingBusinessId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(businessData),
    });

    if (!res.ok) {
      alert(editingBusinessId ? "Failed to update business" : "Failed to create business");
      return;
    }

    resetForm();
    fetchBusinesses();
  }

  async function handleDelete(id: string) {
    const res = await fetch(apiUrl(`/api/businesses/${id}`), {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });

    if (!res.ok) {
      alert("Failed to delete business");
      return;
    }

    setBusinesses((prev) => prev.filter((business) => business.id !== id));
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
            <h1 className="text-3xl font-bold tracking-tight">Businesses</h1>
            <p className="mt-2 text-gray-400">
              Create and manage the businesses connected to your account.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            Log out
          </button>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            {editingBusinessId ? "Edit Business" : "Add Business"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
              placeholder="Business name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <textarea
              className="min-h-24 w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
              placeholder="Business description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Business email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Business phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                placeholder="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                type="submit"
              >
                {editingBusinessId ? "Update Business" : "Add Business"}
              </button>

              {editingBusinessId && (
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
            <h2 className="text-xl font-semibold">Your Businesses</h2>
            <span className="text-sm text-gray-400">
              {businesses.length} total
            </span>
          </div>

          {businesses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-8 text-center text-gray-400">
              No businesses yet. Add your first business above.
            </div>
          ) : (
            <ul className="space-y-4">
              {businesses.map((business) => (
                <li
                  key={business.id}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-sm"
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {business.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {business.description || "No description yet."}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-300">
                      Business
                    </span>
                  </div>

                  <div className="mb-4 text-sm text-gray-400">
                    <p>{business.email || "No email"}</p>
                    <p>{business.phone || "No phone"}</p>
                    <p>{business.website || "No website"}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">

                    <Link
                      href={`/businesses/${business.id}/dashboard`}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      View Dashboard
                    </Link>
                    
                    <Link
                      href={`/businesses/${business.id}/customers`}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      View Customers
                    </Link>

                    <Link
                      href={`/businesses/${business.id}/campaigns`}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      View Campaigns
                    </Link>

                    <button
                      className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700"
                      onClick={() => handleEdit(business)}
                    >
                      Edit
                    </button>

                    <button
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      onClick={() => handleDelete(business.id)}
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
