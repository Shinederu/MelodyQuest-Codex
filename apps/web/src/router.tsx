import { createBrowserRouter, Outlet } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import { Link } from 'react-router-dom';

function Layout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-semibold text-emerald-400">
            MelodyQuest
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/admin" className="hover:text-emerald-300">
              Admin
            </Link>
            <Link to="/lobby" className="hover:text-emerald-300">
              Lobby
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-6rem)] max-w-6xl px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} MelodyQuest. All rights reserved.
      </footer>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'admin', element: <Admin /> },
      { path: 'lobby', element: <Lobby /> },
      { path: 'game/:id', element: <Game /> }
    ]
  }
]);
