import { create } from 'zustand';

export interface PlayerRef {
  id: number;
  username: string;
}

export interface TrackRef {
  id: number;
  title?: string | null;
  youtube_video_id?: string;
  cover_image_url?: string | null;
}

export interface RoundRef {
  id: number;
  game_id: number;
  round_number: number;
  track_id: number;
  started_at?: string | null;
  ended_at?: string | null;
  winner_user_id?: number | null;
  reveal_video?: boolean | number;
  track?: TrackRef | null;
}

export interface GameRef {
  id: number;
  host_user_id: number;
  status: 'LOBBY' | 'RUNNING' | 'ENDED';
  round_count: number;
  created_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface ScoreRef {
  id?: number;
  game_id: number;
  user_id: number;
  points: number;
}

interface GameState {
  game: GameRef | null;
  players: PlayerRef[];
  scores: ScoreRef[];
  currentRound: RoundRef | null;
  rules: Record<string, unknown> | null;
  isHost: boolean;
  setState: (payload: {
    game: GameRef;
    players: PlayerRef[];
    scores: ScoreRef[];
    currentRound: RoundRef | null;
    rules?: Record<string, unknown>;
  }, currentUserId?: number) => void;
  addPlayer: (player: PlayerRef) => void;
  removePlayer: (userId: number) => void;
  setCurrentRound: (round: Partial<RoundRef> & { id: number }) => void;
  setGameStatus: (status: GameRef['status']) => void;
  updateScore: (userId: number, points: number) => void;
  clear: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  players: [],
  scores: [],
  currentRound: null,
  rules: null,
  isHost: false,
  setState: ({ game, players, scores, currentRound, rules }, currentUserId) => {
    set({
      game,
      players,
      scores,
      currentRound,
      rules: rules || null,
      isHost: currentUserId ? game.host_user_id === currentUserId : get().isHost
    });
  },
  addPlayer: (player) => {
    const exists = get().players.some((p) => p.id === player.id);
    if (exists) {
      set({
        players: get().players.map((p) => (p.id === player.id ? player : p))
      });
    } else {
      set({ players: [...get().players, player] });
    }
  },
  removePlayer: (userId) => {
    set({ players: get().players.filter((p) => p.id !== userId) });
  },
  setCurrentRound: (round) => {
    const existing = get().currentRound;
    if (existing && existing.id === round.id) {
      set({ currentRound: { ...existing, ...round } as RoundRef });
    } else {
      set({ currentRound: { ...(round as RoundRef) } });
    }
  },
  setGameStatus: (status) => {
    const game = get().game;
    if (!game) return;
    set({ game: { ...game, status } });
  },
  updateScore: (userId, points) => {
    const scores = get().scores;
    const index = scores.findIndex((s) => s.user_id === userId);
    if (index >= 0) {
      const next = [...scores];
      next[index] = { ...next[index], points };
      set({ scores: next });
    } else {
      const gameId = get().game?.id || 0;
      set({ scores: [...scores, { game_id: gameId, user_id: userId, points }] });
    }
  },
  clear: () => set({ game: null, players: [], scores: [], currentRound: null, rules: null, isHost: false })
}));
