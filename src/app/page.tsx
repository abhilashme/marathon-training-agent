import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏃</span>
          <span className="font-bold text-xl">Marathon Agent</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/pricing" className="text-gray-600 hover:text-gray-900 text-sm">
            Pricing
          </Link>
          <Link
            href="/auth/signin"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
          <span>✨</span> AI-powered marathon coaching
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          From "I have a race"
          <br />
          to a perfect training plan
          <br />
          <span className="text-blue-600">in 5 minutes.</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          Personalized 16–20 week plans that adapt every week based on how you actually train.
          Race week brief included. No coaching degree required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/onboarding"
            className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Build My Training Plan →
          </Link>
          <Link
            href="/pricing"
            className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-medium hover:bg-gray-50 transition-colors"
          >
            See Pricing
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">Free to try · No credit card required</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: "📅",
            title: "Personalized Plan",
            desc: "Enter your race, goal time, and current fitness. Get a week-by-week plan tailored to you — not a generic PDF.",
          },
          {
            icon: "🔄",
            title: "Adapts Every Week",
            desc: "Sync Strava or Garmin. Each Monday, your plan adjusts based on how last week actually went.",
          },
          {
            icon: "🎯",
            title: "Race Week Brief",
            desc: "7 days out: weather forecast, mile-by-mile pacing, fueling strategy, and a pre-race logistics checklist.",
          },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-4xl mb-4">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Social proof numbers */}
      <section className="bg-blue-600 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { stat: "5 min", label: "Average onboarding time" },
            { stat: "≥80%", label: "Target plan adherence rate" },
            { stat: "16–20", label: "Weeks of personalized training" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-bold mb-2">{s.stat}</div>
              <div className="text-blue-200 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Simple, honest pricing</h2>
        <p className="text-gray-600 mb-10">
          Pay once for your race, or unlock unlimited races with a monthly subscription.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
          <div className="border-2 border-gray-200 rounded-2xl p-6">
            <div className="text-sm font-medium text-gray-500 mb-1">Race Prep Pack</div>
            <div className="text-4xl font-bold mb-1">$24</div>
            <div className="text-gray-500 text-sm mb-4">one-time per race</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✓ Full training plan</li>
              <li>✓ Weekly adaptive updates</li>
              <li>✓ Race Week Brief + PDF export</li>
            </ul>
          </div>
          <div className="border-2 border-blue-500 rounded-2xl p-6 relative">
            <div className="absolute -top-3 left-6 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              Best value
            </div>
            <div className="text-sm font-medium text-blue-600 mb-1">Season Pass</div>
            <div className="text-4xl font-bold mb-1">$10</div>
            <div className="text-gray-500 text-sm mb-4">per month</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✓ Unlimited races</li>
              <li>✓ Adaptive weekly coaching loop</li>
              <li>✓ All Race Week Briefs</li>
              <li>✓ Priority feature access</li>
            </ul>
          </div>
        </div>
        <Link
          href="/onboarding"
          className="inline-block mt-8 bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Start Free →
        </Link>
      </section>

      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-500">
        <p>
          Marathon Agent · AI-powered coaching for every runner ·{" "}
          <Link href="/terms" className="hover:underline">Terms</Link> ·{" "}
          <Link href="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
