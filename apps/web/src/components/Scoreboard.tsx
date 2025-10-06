interface Score {
  user_id: number;
  points: number;
}

interface Player {
  id: number;
  username: string;
}

interface ScoreboardProps {
  scores: Score[];
  players: Player[];
}

export function Scoreboard({ scores, players }: ScoreboardProps) {
  const lookup = new Map(players.map((p) => [p.id, p.username] as const));
  const sorted = [...scores].sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Scoreboard</h3>
      <ul className="space-y-2 text-sm text-slate-200">
        {sorted.map((score, index) => (
          <li key={score.user_id} className="flex items-center justify-between rounded-md bg-slate-900/80 px-3 py-2">
            <span>
              <span className="font-semibold text-emerald-200">#{index + 1}</span>{' '}
              {lookup.get(score.user_id) || `Joueur ${score.user_id}`}
            </span>
            <span className="text-emerald-400">{score.points}</span>
          </li>
        ))}
        {sorted.length === 0 && <li className="text-xs text-slate-500">Aucun score pour le moment.</li>}
      </ul>
    </div>
  );
}

export default Scoreboard;
