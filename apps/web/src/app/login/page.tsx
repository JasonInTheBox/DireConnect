"use client";

import Link from "next/link";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }

        window.location.href = "/customers";
    }

    return (
        <main className="min-h-screen bg-gray-950 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back home
          </Link>
        </div>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
          <p className="mt-2 text-gray-400">
            Access your DireConnect business dashboard.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              type="submit"
            >
              Log in
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-400 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </section>
      </div>
    </main>
    )
}
