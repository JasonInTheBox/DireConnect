"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

export default function Home() {

  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchHealth() {
      const res = await fetch(apiUrl("/api/health"));
      const data = await res.json();
      setMessage(data.message);
    }
    fetchHealth();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-400">
            DireConnect
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Connect small businesses with their customers directly.
          </h1>

          <p className="mt-4 max-w-2xl text-gray-400">
            Manage businesses, customers, and promotional campaigns from one
            simple dashboard.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-gray-800 px-4 py-2 font-semibold text-gray-100 hover:bg-gray-700"
            >
              Sign up
            </Link>

            <Link
              href="/businesses"
              className="rounded-lg border border-gray-700 px-4 py-2 font-semibold text-gray-100 hover:bg-gray-800"
            >
              Go to Businesses
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
