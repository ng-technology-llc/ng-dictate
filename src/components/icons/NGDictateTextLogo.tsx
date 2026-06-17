import React from "react";
import wordmarkOnDark from "@/assets/brand/ng-dictate-wordmark-on-dark.png";
import wordmarkOnLight from "@/assets/brand/ng-dictate-wordmark-on-light.png";

const NGDictateTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  const resolvedWidth = width ?? 200;
  const resolvedHeight = height ?? Math.round(resolvedWidth * 0.33);

  return (
    <span
      className={`inline-block ${className ?? ""}`}
      style={{ width: resolvedWidth, height: resolvedHeight }}
      role="img"
      aria-label="NG Dictate"
    >
      <img
        src={wordmarkOnLight}
        alt=""
        aria-hidden="true"
        className="ng-dictate-wordmark-on-light w-full h-full object-contain"
      />
      <img
        src={wordmarkOnDark}
        alt=""
        aria-hidden="true"
        className="ng-dictate-wordmark-on-dark w-full h-full object-contain"
      />
    </span>
  );
};

export default NGDictateTextLogo;
