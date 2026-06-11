'use client';

import { useState } from 'react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm px-3 py-1.5 rounded border border-zinc-300 hover:bg-zinc-100"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
