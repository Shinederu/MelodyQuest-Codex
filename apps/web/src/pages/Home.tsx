import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/http';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

function Home() {
  const [healthStatus, setHealthStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    const response = await api.get<{ status: string }>('/health');
    if (response.ok && response.data) {
      setHealthStatus(`API status: ${response.data.status}`);
    } else {
      setHealthStatus('Impossible de joindre l\'API');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-emerald-300">MelodyQuest</h1>
        <p className="text-slate-400">Le blind-test musical collaboratif.</p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={checkHealth} disabled={loading}>
            {loading ? 'Test...' : 'API Health'}
          </Button>
          <Button variant="outline" disabled>
            Coming Soon
          </Button>
        </div>
        {healthStatus && <p className="text-sm text-slate-400">{healthStatus}</p>}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Administration">
          <p>Gérez les catégories, les titres et les réponses acceptées.</p>
          <Link to="/admin" className="text-sm text-emerald-300">
            Aller vers l\'admin →
          </Link>
        </Card>
        <Card title="Préparer une partie">
          <p>Créez un lobby, invitez vos amis et lancez la partie en quelques clics.</p>
          <Link to="/lobby" className="text-sm text-emerald-300">
            Rejoindre le lobby →
          </Link>
        </Card>
      </div>
    </div>
  );
}

export default Home;
