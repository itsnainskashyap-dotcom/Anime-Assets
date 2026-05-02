import { useRef, useEffect } from "react";

interface BackgroundVideoProps {
  src: string;
  poster: string;
  className?: string;
  overlay?: "cinematic" | "none";
  mobileFallback?: boolean;
}

export function BackgroundVideo({
  src,
  poster,
  className = "absolute inset-0 h-full w-full object-cover",
  overlay = "none",
  mobileFallback = true,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
      });
    }
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        className={`landing-bg-video ${className} pointer-events-none`}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        disablePictureInPicture
        controlsList="nodownload nofullscreen noremoteplayback"
        style={{ display: "block" }}
      />
      {mobileFallback && (
        <div
          className="landing-bg-poster absolute inset-0 bg-cover bg-center hidden"
          style={{ backgroundImage: `url(${poster})` }}
          aria-hidden="true"
        />
      )}
      {overlay === "cinematic" && (
        <>
          <div className="absolute inset-0 bg-black/55 pointer-events-none" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 35%, rgba(217,70,239,0.22), transparent 38%), radial-gradient(circle at 70% 70%, rgba(34,211,238,0.12), transparent 35%)",
            }}
          />
        </>
      )}
    </>
  );
}
