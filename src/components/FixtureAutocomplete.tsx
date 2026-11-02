"use client";

import { useId, useState } from "react";

export type FixtureAutocompleteOption = {
  id: string;
  group: string;
  label: string;
  detail?: string;
  onSelect: () => void;
};

export default function FixtureAutocomplete({
  value,
  onChange,
  onSearch,
  label,
  options,
  loading,
  notice,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  label: string;
  options: FixtureAutocompleteOption[];
  loading: boolean;
  notice?: string;
  placeholder: string;
  className: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    option.onSelect();
    setOpen(false);
    setActiveIndex(-1);
  }

  return <div className="relative">
    <input
      className={className}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
        onSearch(event.target.value);
        setOpen(true);
        setActiveIndex(-1);
      }}
      onFocus={() => {
        onSearch(value);
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setActiveIndex(-1);
        } else if (event.key === "ArrowDown" && options.length) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex((current) => Math.min(current + 1, options.length - 1));
        } else if (event.key === "ArrowUp" && options.length) {
          event.preventDefault();
          setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter" && open && activeIndex >= 0) {
          event.preventDefault();
          choose(activeIndex);
        }
      }}
      role="combobox"
      aria-haspopup="listbox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      aria-label={label}
      placeholder={placeholder}
    />
    {open && <div
      id={listId}
      role="listbox"
      className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-outline-variant/30 bg-white p-2 shadow-xl"
      onMouseDown={(event) => event.preventDefault()}
    >
      {options.map((option, index) => {
        const showGroup = index === 0 || option.group !== options[index - 1].group;
        return <div key={option.id}>
          {showGroup && <p role="presentation" className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{option.group}</p>}
          <button
            id={`${listId}-option-${index}`}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
            className={`block w-full rounded-lg px-2.5 py-2 text-left ${activeIndex === index ? "bg-primary/[0.08]" : "hover:bg-surface-container-low"}`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(index)}
          >
            <span className="block break-words text-sm font-semibold text-on-surface">{option.label}</span>
            {option.detail && <span className="mt-0.5 block break-words text-xs font-normal text-on-surface-variant">{option.detail}</span>}
          </button>
        </div>;
      })}
      {!options.length && <p className="px-2 py-3 text-xs text-on-surface-variant">
        {loading ? "Searching fixture history and the product catalog…" : "No exact matches. Keep typing or use your own description."}
      </p>}
      {options.length > 0 && loading && <p className="px-2 py-2 text-[11px] text-on-surface-variant">Updating suggestions…</p>}
      {notice && <p className="px-2 py-2 text-[11px] text-error">{notice}</p>}
      <p className="border-t border-outline-variant/15 px-2 pt-2 text-[10px] text-on-surface-variant">
        Choose a match, or keep typing a custom description. Use ↑/↓ and Enter to select.
      </p>
    </div>}
  </div>;
}
