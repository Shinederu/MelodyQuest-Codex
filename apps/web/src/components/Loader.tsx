export function Loader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <span className="h-3 w-3 animate-ping rounded-full bg-emerald-400" />
      <span>{label}</span>
    </div>
  );
}

export default Loader;
