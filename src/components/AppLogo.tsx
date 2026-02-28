'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface AppLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function AppLogo({ width = 140, height = 36, className }: AppLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/settings/logo')
      .then((res) => res.json())
      .then((data) => {
        setLogoUrl(data.logoUrl);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div style={{ width, height }} />;
  }

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt="Logo"
        width={width}
        height={height}
        className={className}
        style={{ objectFit: 'contain' }}
        priority
      />
    );
  }

  // Text fallback when no logo is uploaded
  return (
    <span
      className={className}
      style={{ fontSize: height * 0.6, fontWeight: 700, color: '#082f69', lineHeight: 1 }}
    >
      Out<span style={{ color: '#0052cc' }}>Sail</span>
    </span>
  );
}
