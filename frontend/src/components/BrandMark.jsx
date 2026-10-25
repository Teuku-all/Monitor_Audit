export default function BrandMark({ size = 42, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="44" height="44" rx="14" fill="#C2E8FF" />
      <path d="M24 8 37 13v9c0 8.2-5.5 14.3-13 18-7.5-3.7-13-9.8-13-18v-9l13-5Z" fill="#052659" />
      <path d="m17.5 23.5 4.3 4.3 9-9" stroke="#C2E8FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
