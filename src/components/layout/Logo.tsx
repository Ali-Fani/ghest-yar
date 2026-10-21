export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect x="40" y="40" width="944" height="944" rx="236" fill="url(#lg)" />
      <rect x="232" y="288" width="560" height="500" rx="96" fill="#fff" />
      <rect x="232" y="288" width="560" height="140" rx="96" fill="#064e3b" opacity=".92" />
      <rect x="232" y="364" width="560" height="64" fill="#064e3b" opacity=".92" />
      <rect x="336" y="224" width="52" height="120" rx="26" fill="#fff" />
      <rect x="636" y="224" width="52" height="120" rx="26" fill="#fff" />
      <circle cx="512" cy="610" r="118" fill="#10b981" />
      <path d="M466 612l34 34 62-72" fill="none" stroke="#fff" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
