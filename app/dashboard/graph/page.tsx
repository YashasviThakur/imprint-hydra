"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MemoryGraphSection from "@/app/components/MemoryGraphSection";
import BackgroundVideo from "@/app/components/BackgroundVideo";

// Same shape MemoryGraphSection expects: id/content/topic/pinned + a _raw
// blob carrying confidence and contradicts (mirrors dashboard/page.tsx's
// mapApi so the two views stay consistent).
function mapApi(m: any) {
  return {
    id: m.memoryId,
    content: m.content,
    topic: m.topic || "general",
    pinned: !!m.pinned,
    createdAt: m.createdAt,
    _raw: m,
  };
}

export default function MemoryGraphPage() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string })?.id ?? null;

  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        const r = await fetch(`/api/memories?userId=${encodeURIComponent(userId)}&limit=1000`);
        const d = await r.json();
        setMemories((d.memories || []).map(mapApi));
      } catch {
        setMemories([]);
      }
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#050505", padding: "24px 24px 60px", overflow: "hidden" }}>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <BackgroundVideo overlayOpacity={0.6} />
      </div>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1040, margin: "0 auto" }}>
        <Link
          href="/dashboard"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none", marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        {status === "loading" || loading ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            Loading your memory graph…
          </div>
        ) : !userId ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            <a href="/login" style={{ color: "#5EEAD4" }}>Sign in</a> to see your memory graph.
          </div>
        ) : memories.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            No memories yet — save a few, then come back here to see the graph.
          </div>
        ) : (
          <MemoryGraphSection memories={memories} />
        )}
      </div>
    </div>
  );
}
