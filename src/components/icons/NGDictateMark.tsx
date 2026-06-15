const NGDictateMark = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => (
  <svg
    width={width || 126}
    height={height || 126}
    viewBox="0 0 126 126"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect
      x="8"
      y="8"
      width="110"
      height="110"
      rx="28"
      className="fill-logo-stroke"
    />
    <path
      d="M23 76h19c7 0 8-22 16-22 9 0 9 42 18 42 10 0 10-65 20-65 9 0 10 45 18 45h8"
      className="stroke-logo-primary"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="76" cy="96" r="4.5" fill="#7DD3C7" />
  </svg>
);

export default NGDictateMark;
