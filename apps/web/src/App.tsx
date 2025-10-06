function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center gap-6">
      <h1 className="text-5xl font-bold tracking-tight">MelodyQuest</h1>
      <p className="max-w-xl text-lg text-slate-300">
        Embark on a musical adventure. This placeholder interface will soon guide players through quests,
        challenges, and realtime battles synchronized with the MelodyQuest universe.
      </p>
      <div className="flex gap-4">
        <a
          className="px-4 py-2 rounded bg-indigo-500 hover:bg-indigo-600 transition"
          href="/api/health"
          target="_blank"
          rel="noreferrer"
        >
          API Health
        </a>
        <a
          className="px-4 py-2 rounded border border-indigo-400 text-indigo-200 hover:bg-indigo-500/10 transition"
          href="#"
        >
          Coming Soon
        </a>
      </div>
    </main>
  );
}

export default App;
