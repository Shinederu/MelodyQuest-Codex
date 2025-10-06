import { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps extends PropsWithChildren {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function Card({ title, actions, className, children }: CardProps) {
  return (
    <section className={clsx('rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-slate-950/40', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold text-emerald-300">{title}</h2>}
          {actions && <div className="flex items-center gap-2 text-sm text-slate-400">{actions}</div>}
        </header>
      )}
      <div className="flex flex-col gap-4 text-sm text-slate-200">{children}</div>
    </section>
  );
}

export default Card;
