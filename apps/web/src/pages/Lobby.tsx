import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/http';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import Loader from '../components/Loader';
import { useSocket } from '../lib/socket';

interface Category {
  id: number;
  name: string;
  is_active: number;
}

interface PlayerEntry {
  id: number;
  username: string;
}

function Lobby() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [roundCount, setRoundCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState<number | null>(null);
  const [gameLink, setGameLink] = useState('');
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const adminToken = useMemo(() => localStorage.getItem('adminToken') || '', []);
  const headers = useMemo(() => (adminToken ? { 'X-Admin-Token': adminToken } : {}), [adminToken]);

  const { connected, on, off } = useSocket(gameId, user);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      const response = await api.get<Category[]>('/admin/categories', { headers });
      if (response.ok && response.data) {
        setCategories(response.data.filter((category) => category.is_active));
        setError('');
      } else {
        setError('Impossible de charger les catégories actives');
      }
      setLoading(false);
    };

    fetchCategories();
  }, [headers]);

  useEffect(() => {
    if (!gameId || !user) return;

    const handleJoin = (payload: { user_id?: number; userId?: number; username?: string; user?: { username?: string } }) => {
      const id = payload.user_id ?? payload.userId;
      if (!id) return;
      const username = payload.username ?? payload.user?.username ?? `Joueur ${id}`;
      setPlayers((prev) => {
        if (prev.some((player) => player.id === id)) {
          return prev.map((player) => (player.id === id ? { id, username } : player));
        }
        return [...prev, { id, username }];
      });
    };

    const handleLeave = (payload: { user_id?: number; userId?: number }) => {
      const id = payload.user_id ?? payload.userId;
      if (!id) return;
      setPlayers((prev) => prev.filter((player) => player.id !== id));
    };

    on('player:joined', handleJoin);
    on('player:left', handleLeave);

    return () => {
      off('player:joined', handleJoin);
      off('player:left', handleLeave);
    };
  }, [gameId, user, on, off]);

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return;
    const response = await api.post<{ id: number; username: string }>('/users', { username });
    if (response.ok && response.data) {
      setUser({ id: response.data.id, username: response.data.username });
      setUsername('');
      setError('');
    } else {
      setError("Impossible de créer l'utilisateur");
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((categoryId) => categoryId !== id) : [...prev, id]
    );
  };

  const handleCreateGame = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      setError('Créez un utilisateur avant de lancer une partie.');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Choisissez au moins une catégorie active.');
      return;
    }

    setLoading(true);
    const payload = {
      host_user_id: user.id,
      round_count: roundCount,
      category_ids: selectedCategories
    };
    const response = await api.post<{ id: number }>('/games', payload);
    if (response.ok && response.data) {
      const id = response.data.id;
      setGameId(id);
      setPlayers([{ id: user.id, username: user.username }]);
      setMessage('Partie créée ! Partagez le lien avec vos amis.');
      setGameLink(`${window.location.origin}/game/${id}`);
      await api.post(`/games/${id}/join`, { user_id: user.id });
      setError('');
    } else {
      setError('Création de partie impossible');
    }
    setLoading(false);
  };

  const handleStart = async () => {
    if (!gameId || !user) return;
    const response = await api.post(`/games/${gameId}/start`, { user_id: user.id });
    if (response.ok) {
      setMessage('Partie lancée ! Redirection en cours...');
      setTimeout(() => navigate(`/game/${gameId}`), 800);
    } else {
      setError('Impossible de démarrer la partie');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Connexion joueur">
        {user ? (
          <p className="text-sm text-emerald-300">
            Connecté en tant que <strong>{user.username}</strong>
          </p>
        ) : (
          <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
            <Input
              label="Nom du joueur"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Votre pseudo"
            />
            <Button type="submit" disabled={!username.trim()}>
              Enregistrer
            </Button>
          </form>
        )}
      </Card>

      <Card title="Préparation de la partie">
        {loading && categories.length === 0 ? (
          <Loader label="Chargement..." />
        ) : (
          <form onSubmit={handleCreateGame} className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Catégories actives
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-sm"
                  >
                    <span>{category.name}</span>
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                  </label>
                ))}
                {categories.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Aucune catégorie disponible. Vérifiez le token admin.
                  </p>
                )}
              </div>
            </div>

            <Select
              label="Nombre de manches"
              value={roundCount}
              onChange={(event) => setRoundCount(Number(event.target.value))}
            >
              {[5, 10, 15].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>

            <Button type="submit" disabled={!user || selectedCategories.length === 0 || loading}>
              Créer la partie
            </Button>
          </form>
        )}
      </Card>

      {gameId && (
        <Card title={`Lobby #${gameId}`} actions={<span>{connected ? 'Socket connecté' : 'Connexion...'}</span>}>
          <div className="space-y-3 text-sm">
            {message && <p className="text-emerald-300">{message}</p>}
            <div className="flex items-center gap-3">
              <Input
                label="Lien"
                value={gameLink}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(gameLink);
                  setMessage('Lien copié !');
                }}
              >
                Copier
              </Button>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wide text-slate-400">Joueurs connectés</h4>
              <ul className="mt-2 space-y-1 text-sm">
                {players.map((player) => (
                  <li key={player.id} className="rounded bg-slate-900/60 px-3 py-2">
                    {player.username}
                  </li>
                ))}
                {players.length === 0 && <li className="text-xs text-slate-500">En attente de joueurs...</li>}
              </ul>
            </div>
            <Button type="button" onClick={handleStart} disabled={!user}>
              Démarrer la partie
            </Button>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default Lobby;
