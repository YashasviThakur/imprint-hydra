export const metadata = { title: "Privacy Policy — Imprint" };

const SECTIONS = [
  {
    title: "What we collect",
    body: "Your name and email from Google OAuth (for sign-in only), the facts you save or that get extracted from conversations you route through Imprint, and any provider API keys you choose to connect.",
  },
  {
    title: "How it's stored",
    body: "Memories live in AWS DynamoDB under your user id, mirrored into a HydraDB graph for relationship-aware retrieval. API keys are encrypted at rest with AES-256, keyed to your account.",
  },
  {
    title: "Who sees it",
    body: "No one but you. Memories aren't shared across accounts, aren't used to train any model, and aren't sold or shared with third parties. Provider calls (Groq, Jina) send only the minimal text needed for extraction or embedding, not your full memory store.",
  },
  {
    title: "Sharing links",
    body: "If you generate a share link for a specific memory, anyone with that link can view it until you revoke it. Nothing is shared by default.",
  },
  {
    title: "Deleting your data",
    body: "Delete any memory from the dashboard at any time. Deleting your account removes your DynamoDB records and disconnects your OAuth session.",
  },
  {
    title: "Hackathon status",
    body: "This is a Hack Hydra submission, not a funded company. Infrastructure (including the HydraDB graph endpoint) may be temporary or go offline after judging.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-20" style={{ background: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto">
        <a href="/" className="text-sm" style={{ color: "var(--ink-dim)" }}>&larr; Back</a>
        <h1 className="text-3xl md:text-4xl tracking-tight mt-6 mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          Privacy Policy
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
