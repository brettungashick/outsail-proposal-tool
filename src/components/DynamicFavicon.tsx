'use client';

import { useEffect } from 'react';

export default function DynamicFavicon() {
  useEffect(() => {
    fetch('/api/settings/favicon')
      .then((res) => res.json())
      .then((data) => {
        if (data.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.faviconUrl;
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
