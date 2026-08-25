'use client';

import React, { useEffect, useRef, useState } from 'react';

/** ویرایش درجا: نمایش به‌صره متن، با کلیک تبدیل به input می‌شود */
export function InlineEdit({
  value,
  onSave,
  placeholder = '…',
  className = '',
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline-edit ${className}`}
        onClick={() => {
          setDraft(value);
          cancelledRef.current = false;
          setEditing(true);
        }}
        title="برای ویرایش کلیک کن"
      >
        {value || <span className="dim">{placeholder}</span>}
      </button>
    );
  }

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      className="inline-edit-input"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          cancelledRef.current = true;
          setEditing(false);
        }
      }}
    />
  );
}
