import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, ...props }, ref) => {
    return (
      <label className="flex w-full flex-col gap-1 text-sm text-slate-300">
        {label && <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-0',
            className
          )}
          {...props}
        />
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </label>
    );
  }
);

Input.displayName = 'Input';

export default Input;
