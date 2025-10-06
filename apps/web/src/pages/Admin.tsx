import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/http';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { TagInput } from '../components/TagInput';
import Loader from '../components/Loader';

interface Category {
  id: number;
  name: string;
  is_active: number;
}

interface TrackSummary {
  id: number;
  youtube_url: string;
  youtube_video_id: string;
  title?: string | null;
  category_id: number;
  cover_image_url?: string | null;
  answers?: { id: number; answer_text: string }[];
}

function Admin() {
  const [adminToken, setAdminToken] = useState<string>(() => localStorage.getItem('adminToken') || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [error, setError] = useState<string>('');

  const [newCategory, setNewCategory] = useState('');
  const [trackForm, setTrackForm] = useState({
    youtube_url: '',
    category_id: '',
    title: '',
    cover_image_url: ''
  });
  const [trackAnswers, setTrackAnswers] = useState<string[]>([]);
  const [filters, setFilters] = useState({ category_id: '', q: '' });

  const headers = useMemo(() => (adminToken ? { 'X-Admin-Token': adminToken } : {}), [adminToken]);

  useEffect(() => {
    localStorage.setItem('adminToken', adminToken);
  }, [adminToken]);

  const fetchCategories = async () => {
    if (!adminToken) return;
    setLoadingCategories(true);
    const response = await api.get<{ categories: Category[] }>('/admin/categories', { headers });
    if (response.ok && response.data) {
      setCategories(response.data.categories);
    } else {
      setError('Impossible de charger les catégories');
    }
    setLoadingCategories(false);
  };

  const fetchTracks = async () => {
    if (!adminToken) return;
    setLoadingTracks(true);
    const params = new URLSearchParams();
    if (filters.category_id) params.append('category_id', filters.category_id);
    if (filters.q) params.append('q', filters.q);
    const query = params.toString();
    const url = query ? `/admin/tracks?${query}` : '/admin/tracks';
    const response = await api.get<{ tracks: TrackSummary[] }>(url, { headers });
    if (response.ok && response.data) {
      setTracks(response.data.tracks);
    } else {
      setError('Impossible de charger les tracks');
    }
    setLoadingTracks(false);
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    if (adminToken) {
      fetchTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, filters.category_id, filters.q]);

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!newCategory.trim()) return;
    const response = await api.post<Category>('/admin/categories', { name: newCategory }, { headers });
    if (response.ok && response.data) {
      setCategories((prev) => [...prev, response.data]);
      setNewCategory('');
      setError('');
    } else {
      setError("Création de catégorie impossible");
    }
  };

  const handleUpdateCategory = async (category: Category, patch: Partial<Category>) => {
    const response = await api.patch<Category>(`/admin/categories/${category.id}`, patch, { headers });
    if (response.ok && response.data) {
      setCategories((prev) => prev.map((item) => (item.id === category.id ? { ...item, ...patch } : item)));
      setError('');
    } else {
      setError('Mise à jour impossible');
    }
  };

  const handleCreateTrack = async (event: FormEvent) => {
    event.preventDefault();
    if (!trackForm.youtube_url || !trackForm.category_id) {
      setError('URL et catégorie obligatoires');
      return;
    }
    const payload = {
      ...trackForm,
      category_id: Number(trackForm.category_id),
      answers: trackAnswers
    };
    const response = await api.post<TrackSummary>('/admin/tracks', payload, { headers });
    if (response.ok) {
      setTrackForm({ youtube_url: '', category_id: '', title: '', cover_image_url: '' });
      setTrackAnswers([]);
      setError('');
      fetchTracks();
    } else {
      setError("Création du track impossible");
    }
  };

  const handleAddAnswers = async (trackId: number, answers: string[]) => {
    const response = await api.post(`/admin/tracks/${trackId}/answers`, { answers }, { headers });
    if (!response.ok) {
      setError('Ajout de réponses impossible');
    } else {
      setError('');
      setTrackAnswers([]);
      fetchTracks();
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Administration"
        actions={
          <div className="flex items-center gap-3">
            <Input
              label="Admin Token"
              value={adminToken}
              placeholder="Saisissez le token admin"
              onChange={(event) => setAdminToken(event.target.value)}
            />
            <Button variant="secondary" onClick={() => fetchCategories()} disabled={!adminToken}>
              Rafraîchir
            </Button>
          </div>
        }
      >
        {!adminToken && <p className="text-sm text-amber-400">Renseignez votre token admin pour continuer.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Catégories">
          {loadingCategories ? (
            <Loader label="Chargement des catégories..." />
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleCreateCategory} className="flex flex-col gap-3">
                <Input
                  label="Nouvelle catégorie"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Nom de la catégorie"
                />
                <Button type="submit" disabled={!newCategory.trim()}>
                  Ajouter
                </Button>
              </form>
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-100 focus:outline-none"
                      value={category.name}
                      onChange={(event) =>
                        setCategories((prev) =>
                          prev.map((item) => (item.id === category.id ? { ...item, name: event.target.value } : item))
                        )
                      }
                      onBlur={(event) => handleUpdateCategory(category, { name: event.target.value })}
                    />
                    <label className="ml-3 flex items-center gap-2 text-xs text-slate-400">
                      Active
                      <input
                        type="checkbox"
                        checked={Boolean(category.is_active)}
                        onChange={(event) =>
                          handleUpdateCategory(category, { is_active: event.target.checked ? 1 : 0 })
                        }
                      />
                    </label>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-xs text-slate-500">Aucune catégorie enregistrée.</p>}
              </div>
            </div>
          )}
        </Card>

        <Card title="Ajouter un track">
          <form onSubmit={handleCreateTrack} className="flex flex-col gap-4">
            <Input
              label="URL YouTube"
              value={trackForm.youtube_url}
              onChange={(event) => setTrackForm((prev) => ({ ...prev, youtube_url: event.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <Select
              label="Catégorie"
              value={trackForm.category_id}
              onChange={(event) => setTrackForm((prev) => ({ ...prev, category_id: event.target.value }))}
            >
              <option value="">Sélectionner</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input
              label="Titre"
              value={trackForm.title}
              onChange={(event) => setTrackForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Titre optionnel"
            />
            <Input
              label="Image de couverture"
              value={trackForm.cover_image_url}
              onChange={(event) => setTrackForm((prev) => ({ ...prev, cover_image_url: event.target.value }))}
              placeholder="https://..."
            />
            <div>
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-400">Réponses acceptées</span>
              <TagInput value={trackAnswers} onChange={setTrackAnswers} placeholder="Ajouter une réponse" />
            </div>
            <Button type="submit" disabled={!trackForm.youtube_url || !trackForm.category_id}>
              Enregistrer le track
            </Button>
          </form>
        </Card>
      </div>

      <Card
        title="Tracks"
        actions={
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <Select
              label="Filtrer par catégorie"
              value={filters.category_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, category_id: event.target.value }))}
            >
              <option value="">Toutes</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Input
              label="Recherche"
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Titre ou URL"
            />
          </div>
        }
      >
        {loadingTracks ? (
          <Loader label="Chargement des tracks..." />
        ) : (
          <div className="space-y-4">
            {tracks.map((track) => (
              <div key={track.id} className="space-y-2 rounded-lg bg-slate-900/60 p-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Video ID</span>
                  <span className="font-mono text-emerald-300">{track.youtube_video_id}</span>
                </div>
                {track.title && <div className="text-lg font-semibold text-slate-100">{track.title}</div>}
                <div className="text-xs text-slate-400">
                  Catégorie: {categories.find((c) => c.id === track.category_id)?.name || '—'}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-emerald-200">
                  {(track.answers || []).map((answer) => (
                    <span key={answer.id} className="rounded-full bg-emerald-500/10 px-2 py-1">
                      {answer.answer_text}
                    </span>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleAddAnswers(track.id, trackAnswers)}
                  disabled={trackAnswers.length === 0}
                >
                  Ajouter les réponses saisies
                </Button>
              </div>
            ))}
            {tracks.length === 0 && <p className="text-xs text-slate-500">Aucun track pour ces filtres.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Admin;
