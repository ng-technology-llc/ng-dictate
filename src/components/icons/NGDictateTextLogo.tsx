/* eslint-disable i18next/no-literal-string */
import React from "react";

const NGDictateTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 930 328"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="NG Dictate"
    >
      <text
        x="40"
        y="150"
        className="logo-primary"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="118"
        fontWeight="800"
        letterSpacing="0"
      >
        NG
      </text>
      <text
        x="40"
        y="260"
        className="logo-stroke"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="96"
        fontWeight="700"
        letterSpacing="0"
      >
        Dictate
      </text>
    </svg>
  );
};

export default NGDictateTextLogo;
