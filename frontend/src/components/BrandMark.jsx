export default function BrandMark({ size = 42, className = '' }) {
  return <img src="/audit-logo.png" width={size} height={size} alt="" aria-hidden="true" className={`brand-logo ${className}`} />;
}
