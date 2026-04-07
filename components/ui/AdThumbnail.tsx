"use client";

import { useState } from "react";

interface AdThumbnailProps {
  src: string;
  alt?: string;
  size?: "sm" | "md";
}

export default function AdThumbnail({ src, alt = "", size = "sm" }: AdThumbnailProps) {
  const [showPopup, setShowPopup] = useState(false);

  const sizeClass = size === "sm" ? "w-16 h-16" : "w-20 h-20";

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setShowPopup(true)}
      onMouseLeave={() => setShowPopup(false)}
    >
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-lg object-cover bg-bg-hover cursor-pointer border border-border/50`}
      />
      {showPopup && (
        <div className="absolute z-50 left-0 top-full mt-2 p-1.5 bg-bg-surface border border-border rounded-xl shadow-2xl">
          <img
            src={src}
            alt={alt}
            className="w-96 h-96 rounded-lg object-contain bg-bg-primary"
          />
        </div>
      )}
    </div>
  );
}
