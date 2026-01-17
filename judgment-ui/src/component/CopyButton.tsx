'use client';  // ← これが Client Component の宣言

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}
