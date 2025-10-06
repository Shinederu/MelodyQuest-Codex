import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline';
};

const baseClasses = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400';

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-emerald-500 text-slate-900 hover:bg-emerald-400',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
    outline: 'border border-slate-600 text-slate-100 hover:bg-slate-800'
  }[variant];

  return <button className={clsx(baseClasses, variantClasses, className)} {...props} />;
}

export default Button;
