'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/utils';

interface ShareLink {
  id: string;
  token: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

interface ShareManagerProps {
  projectId: string;
  shareLinks: ShareLink[];
  onRefresh: () => void;
}

export default function ShareManager({ projectId, shareLinks, onRefresh }: ShareManagerProps) {
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, email }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewLink(data.shareUrl);
        setEmail('');
        onRefresh();
      }
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Client email address"
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Generate Link'}
        </button>
      </form>

      {newLink && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800 font-medium mb-2">Share link created!</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLink}
              readOnly
              className="flex-1 px-3 py-1.5 bg-white border border-green-300 rounded text-sm text-slate-700"
            />
            <button
              onClick={() => copyLink(newLink)}
              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {shareLinks.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Existing Share Links</h4>
          <div className="space-y-2">
            {shareLinks.map((link) => {
              const isExpired = new Date(link.expiresAt) < new Date();
              const shareUrl = `${window.location.origin}/share/${link.token}`;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-slate-700">{link.email}</p>
                    <p className="text-xs text-slate-400">
                      Created {formatDate(link.createdAt)}
                      {isExpired ? (
                        <span className="text-red-500 ml-2">Expired</span>
                      ) : (
                        <span className="text-green-500 ml-2">
                          Expires {formatDate(link.expiresAt)}
                        </span>
                      )}
                    </p>
                  </div>
                  {!isExpired && (
                    <button
                      onClick={() => copyLink(shareUrl)}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition"
                    >
                      Copy Link
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
