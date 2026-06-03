// frontend/src/App.tsx

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
            Stage 0.4
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            Robot Arm Simulator
          </h1>

          <p className="mt-4 max-w-2xl text-slate-300">
            Local development configuration is active. The frontend is running
            with React, TypeScript, Vite, pnpm, and Tailwind CSS.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatusCard label="Frontend" value="localhost:5173" />
            <StatusCard label="Backend" value="localhost:8000" />
            <StatusCard label="Styling" value="Tailwind CSS" />
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}
