// frontend/src/App.tsx

import { BackendHealthCard } from "./components/system/BackendHealthCard";

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
            Stage 0.5
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Robot Arm Simulator
          </h1>

          <p className="mt-4 max-w-2xl text-slate-300">
            Frontend/backend health integration is active. The React app checks
            the FastAPI backend through the Vite development proxy.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatusCard label="Frontend" value="localhost:5173" />
            <StatusCard label="Proxy" value="/health" />
            <BackendHealthCard />
          </div>
        </div>
      </section>
    </main>
  );
}

interface StatusCardProps {
  label: string;
  value: string;
}

function StatusCard({ label, value }: StatusCardProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-mono text-sm text-slate-100">{value}</p>
    </section>
  );
}
