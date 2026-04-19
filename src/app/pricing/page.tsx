"use client";

import { useState } from "react";
import Link from "next/link";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handlePurchase(plan: "race_prep_pack" | "season_pass") {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        window.location.href = "/auth/signin?callbackUrl=/pricing";
        return;
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="font-bold">Marathon Agent</span>
          </Link>
          <Link href="/dashboard" className="ml-auto text-sm text-gray-500 hover:text-gray-700">
            Dashboard →
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Simple, honest pricing</h1>
        <p className="text-gray-500 text-lg mb-12">
          One race or unlimited — your call. No hidden fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* Race Prep Pack */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8">
            <div className="text-sm font-medium text-gray-500 mb-2">Race Prep Pack</div>
            <div className="text-5xl font-bold mb-1">$24</div>
            <div className="text-gray-400 text-sm mb-6">one-time · per race</div>
            <ul className="space-y-3 text-sm text-gray-700 mb-8">
              {[
                "Full 16-20 week training plan",
                "Weekly adaptive plan adjustments",
                "Race Week Brief with pacing + fueling",
                "PDF export",
                "Strava/Garmin sync",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePurchase("race_prep_pack")}
              disabled={loading === "race_prep_pack"}
              className="w-full border-2 border-gray-900 text-gray-900 py-3 rounded-xl font-semibold hover:bg-gray-900 hover:text-white transition-colors disabled:opacity-50"
            >
              {loading === "race_prep_pack" ? "Loading…" : "Buy Race Prep Pack"}
            </button>
          </div>

          {/* Season Pass */}
          <div className="bg-white rounded-2xl border-2 border-blue-500 p-8 relative">
            <div className="absolute -top-3 left-8 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Best value
            </div>
            <div className="text-sm font-medium text-blue-600 mb-2">Season Pass</div>
            <div className="text-5xl font-bold mb-1">$10</div>
            <div className="text-gray-400 text-sm mb-6">per month · cancel anytime</div>
            <ul className="space-y-3 text-sm text-gray-700 mb-8">
              {[
                "Unlimited races",
                "Adaptive weekly coaching loop",
                "All Race Week Briefs included",
                "Priority feature access",
                "Post-race reflection (v1.5)",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-blue-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handlePurchase("season_pass")}
              disabled={loading === "season_pass"}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading === "season_pass" ? "Loading…" : "Start Season Pass"}
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-400 mt-8">
          All plans include a free preview of your first 2 training weeks before purchase.
          Questions? Email us at hello@marathon-agent.com
        </p>
      </div>
    </div>
  );
}
