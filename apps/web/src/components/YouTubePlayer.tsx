import { useEffect, useRef } from 'react';
import { loadYouTubeIframeAPI } from '../lib/youtube';

type YouTubePlayerProps = {
  videoId: string;
  hidden?: boolean;
  onReady?: (player: YT.Player) => void;
  onEnd?: () => void;
};

export function YouTubePlayer({ videoId, hidden = false, onReady, onEnd }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YT.Player | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        if (playerRef.current) {
          playerRef.current.loadVideoById(videoId);
          return;
        }

        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          events: {
            onReady: () => {
              onReady?.(playerRef.current!);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) {
                onEnd?.();
              }
            }
          },
          playerVars: {
            autoplay: 0,
            controls: hidden ? 0 : 1,
            modestbranding: 1,
            rel: 0
          }
        });
      })
      .catch((err) => {
        console.error('Failed to load YouTube API', err);
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, hidden, onReady, onEnd]);

  useEffect(() => {
    const iframe = playerRef.current?.getIframe();
    if (iframe) {
      iframe.style.display = hidden ? 'none' : 'block';
    }
  }, [hidden]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-lg"
      style={{
        aspectRatio: '16 / 9',
        display: hidden ? 'none' : 'block'
      }}
    />
  );
}

export default YouTubePlayer;
