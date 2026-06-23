"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function handleSignup(e: React.FormEvent) {
        e.preventDefault();

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            alert(error.message);
            return;
        }
        
        alert("Signup successful. Check your email if confirmation is enabled.");
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
          <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
          <p className="mt-2 text-gray-400">
            Start managing your businesses and customer promotions.
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
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
                placeholder="Choose a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              type="submit"
            >
              Create Account
            </button>
          </form>

          <p className="mt-6 text-sm text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-400 hover:underline"
            >
              Log in
            </Link>
          </p>
        </section>
      </div>
    </main>
    )
}
