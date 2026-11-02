"use client";

import { useId, useState } from "react";

export default function FixtureTypePicker({
  value,
  onChange,
  label,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: readonly string[];
  className: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const visibleOptions = filter === null
    ? options
    : options.filter((option) => option.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setFilter(null);
    setActiveIndex(-1);
  }

  return <div
    className="relative"
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
        setFilter(null);
        setActiveIndex(-1);
      }
    }}
  >
    <input
      className={`${className} pr-10`}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
        setFilter(event.target.value);
        setOpen(true);
        setActiveIndex(-1);
      }}
      onFocus={() => {
        setFilter(null);
        setOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setFilter(null);
          setActiveIndex(-1);
        } else if (event.key === "ArrowDown" && visibleOptions.length) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1));
        } else if (event.key === "ArrowUp" && visibleOptions.length) {
          event.preventDefault();
          setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === "Enter" && open && activeIndex >= 0) {
          event.preventDefault();
          choose(visibleOptions[activeIndex]);
        }
      }}
      role="combobox"
      aria-haspopup="listbox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      aria-label={label}
      placeholder="Type or choose a fixture type"
    />
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Show ${label.toLowerCase()} options`}
      aria-expanded={open}
      className="absolute right-1 top-2.5 rounded-lg px-2 py-1 text-on-surface-variant hover:bg-surface-container-low"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (open && filter === null) {
          setOpen(false);
        } else {
          setFilter(null);
          setOpen(true);
        }
      }}
    >
      <span aria-hidden="true">▾</span>
    </button>
    {open && <div
      id={listId}
      role="listbox"
      className="absolute z-40 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-outline-variant/30 bg-white p-2 shadow-xl"
      onMouseDown={(event) => event.preventDefault()}
    >
      {visibleOptions.map((option, index) => <button
        key={option}
        id={`${listId}-option-${index}`}
        type="button"
        role="option"
        aria-selected={value === option}
        className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium text-on-surface ${activeIndex === index ? "bg-primary/[0.08]" : "hover:bg-surface-container-low"}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        {option}
      </button>)}
      {!visibleOptions.length && <p className="px-2 py-3 text-xs text-on-surface-variant">
        No matching fixture types. Keep typing to use a custom type.
      </p>}
    </div>}
  </div>;
}
