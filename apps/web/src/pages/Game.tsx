import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/http';
import { useAuthStore } from '../store/auth';
import { useGameStore } from '../store/game';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import Loader from '../components/Loader';
import Scoreboard from '../components/Scoreboard';
import YouTubePlayer from '../components/YouTubePlayer';
import { useSocket } from '../lib/socket';

interface GameStateResponse {
  game: any;
  players: any[];
  currentRound: any;
  scores: any[];
  rules: Record<string, unknown>;
}

function Game() {
  const params = useParams();
  const gameId = useMemo(() => {
    const raw = params.id;
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }, [params.id]);

  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { on, off } = useSocket(gameId, user);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState('');
  const [hasSolved, setHasSolved] = useState(false);
  const [timer, setTimer] = useState(60);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const game = useGameStore((state) => state.game);
  const players = useGameStore((state) => state.players);
  const scores = useGameStore((state) => state.scores);
  const currentRound = useGameStore((state) => state.currentRound);
  const setState = useGameStore((state) => state.setState);
  const addPlayer = useGameStore((state) => state.addPlayer);
  const removePlayer = useGameStore((state) => state.removePlayer);
  const setCurrentRound = useGameStore((state) => state.setCurrentRound);
  const updateScore = useGameStore((state) => state.updateScore);
  const setGameStatus = useGameStore((state) => state.setGameStatus);

  const fetchState = useCallback(
    async (options: { resetTimer?: boolean; showSpinner?: boolean } = { resetTimer: true, showSpinner: false }) => {
      if (!gameId) return;
      if (options.showSpinner) {
        setLoading(true);
      }
      const response = await api.get<GameStateResponse>(`/games/${gameId}/state`);
      if (response.ok && response.data) {
        const { game: rawGame, players: rawPlayers, currentRound: rawRound, scores: rawScores, rules } = response.data;
        const formattedPlayers = rawPlayers.map((entry) => ({
          id: entry.user_id,
          username: entry.user?.username ?? `Joueur ${entry.user_id}`
        }));
        const formattedScores = rawScores.map((entry) => ({
          user_id: entry.user_id,
          points: entry.points
        }));
        const formattedRound = rawRound
          ? {
              id: rawRound.id,
              game_id: rawRound.game_id,
              round_number: rawRound.round_number,
              track_id: rawRound.track_id,
              started_at: rawRound.started_at,
              ended_at: rawRound.ended_at,
              winner_user_id: rawRound.winner_user_id,
              reveal_video: Boolean(rawRound.reveal_video),
              track: rawRound.track
                ? {
                    id: rawRound.track.id,
                    title: rawRound.track.title,
                    youtube_video_id: rawRound.track.youtube_video_id,
                    cover_image_url: rawRound.track.cover_image_url
                  }
                : null
            }
          : null;
        const formattedGame = {
          id: rawGame.id,
          host_user_id: rawGame.host_user_id,
          status: rawGame.status,
          round_count: rawGame.round_count,
          started_at: rawGame.started_at,
          ended_at: rawGame.ended_at
        } as const;

        setState(
          {
            game: formattedGame,
            players: formattedPlayers,
            scores: formattedScores,
            currentRound: formattedRound,
            rules
          },
          user?.id
        );

        if (options.resetTimer) {
          setTimer(60);
        }

        setWinnerId(formattedRound?.winner_user_id ?? null);
        if (!formattedRound || formattedRound.winner_user_id) {
          setHasSolved(false);
        }
        setFeedback('');
        setError('');
      } else {
        setError('Impossible de charger la partie');
      }
      if (options.showSpinner) {
        setLoading(false);
      }
    },
    [gameId, setState, user?.id]
  );

  useEffect(() => {
    fetchState({ resetTimer: true, showSpinner: true });
  }, [fetchState]);

  useEffect(() => {
    if (!currentRound) return;
    setTimer(60);
    const interval = setInterval(() => {
      setTimer((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentRound?.id]);

  useEffect(() => {
    if (!gameId) return;

    const handleRoundStart = () => {
      setHasSolved(false);
      setWinnerId(null);
      setFeedback('Nouvelle manche !');
      fetchState({ resetTimer: true, showSpinner: false });
    };

    const handleRoundSolved = (payload: any) => {
      const winner = payload.winner_user_id ?? payload.winnerUserId;
      if (winner) {
        setWinnerId(winner);
        if (winner === user?.id) {
          setHasSolved(true);
          setFeedback('Bonne réponse !');
        } else {
          setFeedback('Manche résolue !');
        }
      }
      setCurrentRound({
        id: payload.round_id ?? payload.roundId,
        winner_user_id: winner,
        reveal_video: true,
        track: payload.track
          ? {
              id: payload.track.id,
              title: payload.track.title,
              youtube_video_id: payload.track.youtube_video_id,
              cover_image_url: payload.track.cover_image_url
            }
          : undefined
      });
      fetchState({ resetTimer: false, showSpinner: false });
    };

    const handlePlayerJoined = (payload: any) => {
      const id = payload.user_id ?? payload.userId;
      if (!id) return;
      const username = payload.username ?? payload.user?.username ?? `Joueur ${id}`;
      addPlayer({ id, username });
    };

    const handlePlayerLeft = (payload: any) => {
      const id = payload.user_id ?? payload.userId;
      if (!id) return;
      removePlayer(id);
    };

    const handleScoreUpdate = (payload: any) => {
      if (payload.user_id ?? payload.userId) {
        const id = payload.user_id ?? payload.userId;
        if (typeof payload.points === 'number') {
          updateScore(id, payload.points);
        }
      }
    };

    const handleGameEnded = () => {
      setGameStatus('ENDED');
      fetchState({ resetTimer: false, showSpinner: false });
    };

    on('round:start', handleRoundStart);
    on('round:solved', handleRoundSolved);
    on('player:joined', handlePlayerJoined);
    on('player:left', handlePlayerLeft);
    on('score:update', handleScoreUpdate);
    on('game:ended', handleGameEnded);

    return () => {
      off('round:start', handleRoundStart);
      off('round:solved', handleRoundSolved);
      off('player:joined', handlePlayerJoined);
      off('player:left', handlePlayerLeft);
      off('score:update', handleScoreUpdate);
      off('game:ended', handleGameEnded);
    };
  }, [gameId, on, off, addPlayer, removePlayer, updateScore, setGameStatus, setCurrentRound, fetchState, user?.id]);

  const submitGuess = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !currentRound || !guess.trim()) return;
    setFeedback('');
    const response = await api.post<{ is_correct: boolean }>(`/rounds/${currentRound.id}/guess`, {
      user_id: user.id,
      guess_text: guess
    });
    if (response.ok && response.data) {
      if (response.data.is_correct) {
        setHasSolved(true);
        setFeedback('Bonne réponse !');
      } else {
        setFeedback('Mauvaise réponse, réessayez.');
      }
    } else {
      setFeedback("Erreur lors de l'envoi de la réponse");
    }
    setGuess('');
  };

  const handleNextRound = async () => {
    if (!gameId || !user) return;
    const response = await api.post(`/games/${gameId}/next`, { user_id: user.id });
    if (!response.ok) {
      setFeedback('Impossible de passer à la manche suivante');
    }
  };

  if (!gameId) {
    return <p className="text-sm text-red-400">Identifiant de partie invalide.</p>;
  }

  if (loading && !currentRound) {
    return <Loader label="Chargement de la partie..." />;
  }

  const host = players.find((player) => player.id === game?.host_user_id);
  const winnerName = winnerId ? players.find((player) => player.id === winnerId)?.username : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <header className="mb-4 flex items-center justify-between text-sm text-slate-400">
            <span>Partie #{game?.id}</span>
            <span>Manche {currentRound?.round_number ?? '—'} / {game?.round_count ?? '—'}</span>
            <span>Host : {host?.username ?? '—'}</span>
            <span>Timer : {timer}s</span>
          </header>

          {currentRound?.track?.youtube_video_id ? (
            <YouTubePlayer
              videoId={currentRound.track.youtube_video_id}
              hidden={!currentRound.reveal_video}
              onEnd={() => setFeedback('La vidéo est terminée.')}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 text-sm text-slate-500">
              En attente du prochain morceau...
            </div>
          )}

          {!currentRound?.reveal_video && currentRound?.track?.cover_image_url && (
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <img src={currentRound.track.cover_image_url} alt={currentRound.track.title ?? 'Cover'} className="h-48 w-full object-cover" />
            </div>
          )}

          {winnerName && (
            <div className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {winnerName} a trouvé la bonne réponse !
            </div>
          )}

          <form onSubmit={submitGuess} className="mt-6 flex flex-col gap-3">
            <Input
              label="Ta réponse"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder="Devine le titre ou l'artiste"
              disabled={!user || !currentRound || hasSolved || Boolean(currentRound?.winner_user_id)}
            />
            <Button type="submit" disabled={!user || !currentRound || hasSolved}>
              Envoyer
            </Button>
          </form>

          {feedback && <p className="mt-3 text-sm text-emerald-300">{feedback}</p>}

          {game?.host_user_id === user?.id && currentRound?.winner_user_id && (
            <Button type="button" className="mt-4" onClick={handleNextRound}>
              Prochaine manche
            </Button>
          )}

          {game?.status === 'ENDED' && (
            <div className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Partie terminée ! Merci d'avoir joué.
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <aside className="space-y-4">
        <Scoreboard scores={scores} players={players} />
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Joueurs</h3>
          <ul className="space-y-1">
            {players.map((player) => (
              <li key={player.id} className="rounded bg-slate-900/60 px-3 py-2">
                {player.username}
                {player.id === game?.host_user_id && <span className="ml-2 text-xs text-emerald-300">(Host)</span>}
                {player.id === user?.id && <span className="ml-2 text-xs text-emerald-200">(Moi)</span>}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="secondary" onClick={() => navigate('/lobby')}>
          Retour au lobby
        </Button>
      </aside>
    </div>
  );
}

export default Game;
