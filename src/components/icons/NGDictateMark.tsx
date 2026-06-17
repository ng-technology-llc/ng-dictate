import React from "react";

const NGDictateMark = ({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => {
  const id = React.useId().replace(/:/g, "");
  const gradientId = `${id}-signal`;
  const fadeId = `${id}-edge-fade`;
  const blurId = `${id}-edge-blur`;

  return (
    <svg
      width={width || 126}
      height={height || 126}
      viewBox="0 0 1024 1024"
      className={`ng-dictate-mark ${className ?? ""}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="52"
          y1="512"
          x2="940"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            stopColor="var(--ng-dictate-mark-color, var(--color-logo-primary))"
            stopOpacity="0"
          />
          <stop
            offset="0.1"
            stopColor="var(--ng-dictate-mark-color, var(--color-logo-primary))"
          />
          <stop
            offset="0.48"
            stopColor="var(--ng-dictate-mark-color, var(--color-logo-primary))"
          />
          <stop
            offset="0.74"
            stopColor="var(--ng-dictate-mark-color, var(--color-logo-primary))"
          />
          <stop
            offset="1"
            stopColor="var(--ng-dictate-mark-color, var(--color-logo-primary))"
            stopOpacity="0"
          />
        </linearGradient>
        <linearGradient
          id={fadeId}
          x1="64"
          y1="0"
          x2="960"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="black" stopOpacity="0" />
          <stop offset="0.11" stopColor="white" stopOpacity="1" />
          <stop offset="0.89" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <mask id={`${fadeId}-mask`} maskUnits="userSpaceOnUse">
          <rect width="1024" height="1024" fill={`url(#${fadeId})`} />
        </mask>
        <filter
          id={blurId}
          x="32"
          y="260"
          width="960"
          height="504"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <path
        d="M52 548C124 548 140 548 168 514C194 482 214 466 238 548C258 614 280 614 302 548C330 456 346 388 372 388C400 388 412 486 436 604C456 704 484 704 508 604C536 454 552 314 584 314C616 314 632 456 658 600C678 708 710 700 736 628C760 572 780 578 820 578H940"
        stroke={`url(#${gradientId})`}
        strokeWidth="72"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
        filter={`url(#${blurId})`}
        mask={`url(#${fadeId}-mask)`}
      />
      <path
        d="M52 548C124 548 140 548 168 514C194 482 214 466 238 548C258 614 280 614 302 548C330 456 346 388 372 388C400 388 412 486 436 604C456 704 484 704 508 604C536 454 552 314 584 314C616 314 632 456 658 600C678 708 710 700 736 628C760 572 780 578 820 578H940"
        stroke={`url(#${gradientId})`}
        strokeWidth="52"
        strokeLinecap="round"
        strokeLinejoin="round"
        mask={`url(#${fadeId}-mask)`}
      />
    </svg>
  );
};

export default NGDictateMark;
