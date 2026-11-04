export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Projeto Popa">
      <defs>
        <linearGradient id="popaG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#86efac" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#121513" />
      <rect x="1" y="1" width="62" height="62" rx="15" fill="none" stroke="#22c55e" strokeOpacity=".45" strokeWidth="2" />
      <path d="M23 47V17h13.5a9.5 9.5 0 0 1 0 19H23" fill="none" stroke="url(#popaG)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
