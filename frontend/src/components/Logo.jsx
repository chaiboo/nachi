export default function Logo({ size = 28 }) {
  // Nachi at the threshold. Ink parts use currentColor (themed);
  // sill + tilak use --pyre (stays vermilion in both modes).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-label="Nachi"
      role="img"
    >
      <path
        d="M 14 54 L 14 26 Q 14 10 32 10 Q 50 10 50 26 L 50 54"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="54"
        x2="54"
        y2="54"
        stroke="var(--pyre)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="29" y="34" width="6" height="20" fill="currentColor" rx="1" />
      <circle cx="32" cy="30" r="4" fill="currentColor" />
      <circle cx="32" cy="29" r="1.3" fill="var(--pyre)" />
    </svg>
  )
}
