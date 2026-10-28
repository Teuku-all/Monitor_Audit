export default function BrandMark({ size = 42, className = '' }) {
  return <img src="/sigap-logo.svg" width={size} height={size} alt="" aria-hidden="true" decoding="async" className={`brand-logo ${className}`} />;
}
