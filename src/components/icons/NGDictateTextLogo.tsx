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
      <picture className="block h-full w-full">
        <source media="(prefers-color-scheme: dark)" srcSet={wordmarkOnDark} />
        <img
          src={wordmarkOnLight}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
      </picture>
    </span>
  );
};

export default NGDictateTextLogo;
