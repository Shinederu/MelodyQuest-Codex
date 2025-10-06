import { useState } from 'react';
import clsx from 'clsx';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TagInput({ value, onChange, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInputValue('');
      return;
    }
    onChange([...value, trimmed]);
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className={clsx(
          'flex flex-wrap gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100'
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300"
          >
            {tag}
            <button
              type="button"
              className="text-xs text-emerald-200 hover:text-emerald-100"
              onClick={() => removeTag(tag)}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              handleAdd();
            }
            if (e.key === 'Backspace' && !inputValue) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] border-none bg-transparent text-slate-100 focus:outline-none"
        />
      </div>
      <div className="text-xs text-slate-500">Appuyez sur Entrée pour ajouter une réponse.</div>
    </div>
  );
}

export default TagInput;
