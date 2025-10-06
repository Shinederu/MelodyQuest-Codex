import { forwardRef, SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, label, children, ...props }, ref) => {
  return (
    <label className="flex w-full flex-col gap-1 text-sm text-slate-300">
      {label && <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-0',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
});

Select.displayName = 'Select';

export default Select;
