// frontend/src/components/system/BackendHealthCard.tsx

import { useEffect, useState } from "react";

import { getBackendHealth, type HealthResponse } from "../../api/healthApi";

type HealthState =
  | { status: "loading" }
  | { status: "online"; data: HealthResponse }
  | { status: "offline"; error: string };

export function BackendHealthCard() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });

  async function checkHealth() {
    setHealth({ status: "loading" });

    try {
      const data = await getBackendHealth();
      setHealth({ status: "online", data });
    } catch (error) {
      setHealth({
        status: "offline",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  useEffect(() => {
    void checkHealth();
  }, []);

  if (health.status === "loading") {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">
        <p className="text-sm text-slate-400">Backend</p>
        <p className="mt-2 font-mono text-sm text-yellow-300">checking...</p>
      </section>
    );
  }

  if (health.status === "offline") {
    return (
      <section className="rounded-xl border border-red-900/70 bg-red-950/40 p-5">
        <p className="text-sm text-slate-400">Backend</p>
        <p className="mt-2 font-mono text-sm text-red-300">offline</p>
        <p className="mt-2 text-sm text-red-200">{health.error}</p>

        <button
          type="button"
          onClick={() => void checkHealth()}
          className="mt-4 rounded-lg border border-red-800 px-3 py-2 text-sm text-red-100 hover:bg-red-900/40"
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/30 p-5">
      <p className="text-sm text-slate-400">Backend</p>
      <p className="mt-2 font-mono text-sm text-emerald-300">
        {health.data.status}
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Environment:{" "}
        <span className="font-mono text-slate-100">
          {health.data.environment}
        </span>
      </p>
    </section>
  );
}
