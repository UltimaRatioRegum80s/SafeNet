import { useState } from "react";
import clsx from "clsx";

export default function NNImage({
  src, alt, className, onClick,
}: { src: string; alt: string; className?: string; onClick?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [ok, setOk] = useState(true);

  if (!ok) {
    return (
      <div
        role="img" aria-label="image unavailable"
        className={clsx("rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 image-card", className)}
      >
        📷
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setOk(false)}
      onClick={onClick}
      className={clsx(
        "rounded-lg object-cover transition-opacity duration-300 image-card",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}