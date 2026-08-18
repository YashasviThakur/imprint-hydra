export const metadata = { title: "Terms of Service — Imprint" };

const SECTIONS = [
  {
    title: "What this is",
    body: "Imprint is a hackathon project (Hack Hydra, HydraDB's open-source launch hackathon) that gives AI coding agents a persistent memory graph. It's provided as-is, without uptime guarantees, and is not a commercial product.",
  },
  {
    title: "Your account",
    body: "You sign in with Google OAuth. You're responsible for the activity that happens under your account and for any API keys you connect (Groq, Jina, or others), which stay associated with your user id only.",
  },
  {
    title: "Your data",
    body: "Facts you save, or that Imprint extracts from your conversations, are stored under your user id in AWS DynamoDB and mirrored into a HydraDB graph. You can delete individual memories from the dashboard at any time; deleting your account removes the underlying records.",
  },
  {
    title: "Acceptable use",
    body: "Don't use Imprint to store data you don't have the right to store, or to attack, scrape, or overload the service. Don't attempt to access another user's memories.",
  },
  {
    title: "No warranty",
    body: "This is a hackathon build. It may go offline, lose data, or change without notice. Don't rely on it for anything you can't afford to lose.",
  },
  {
    title: "Changes",
    body: "These terms may change as the project evolves. Continued use after a change means you accept the update.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-sm" style={{ color: "var(--ink-dim)" }}>&larr; Back</a>
        <h1 className="text-3xl md:text-4xl tracking-tight mt-6 mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          Terms of Service
        </h1>
        <p className="text-xs mb-12" style={{ color: "var(--ink-dim)", fontFamily: "var(--font-mono)" }}>Last updated 2026-08-19</p>

        <div className="flex flex-col gap-8">
          {SECTIONS.map((s) => (
            <div key={s.title} className="pb-8 border-b" style={{ borderColor: "var(--rule)" }}>
              <h2 className="text-lg mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{s.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>{s.body}</p>
            </div>
          ))}
        </div>

        <p className="text-xs mt-10" style={{ color: "var(--ink-dim)" }}>
          Questions? Open an issue on <a href="https://github.com/YashasviThakur/imprint-hydra" className="underline" style={{ color: "var(--brass)" }}>GitHub</a>.
        </p>
      </div>
    </main>
  );
}
