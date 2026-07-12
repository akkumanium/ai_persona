"use client";

export default function StudioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-stone-950">The studio could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Your data is safe. Retry the request, or come back after the service has recovered.</p>
        <button onClick={reset} className="mt-5 rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Retry</button>
      </div>
    </main>
  );
}
