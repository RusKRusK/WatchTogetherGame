import { useEffect, useRef } from "preact/hooks";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    // deno-lint-ignore no-explicit-any
    YT: any;
  }
}

interface VideoPlayerProps {
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  isHost: boolean;
  socket: WebSocket | null;
}

export function VideoPlayer(
  { videoId, startSeconds, endSeconds, isHost, socket }: VideoPlayerProps,
) {
  // deno-lint-ignore no-explicit-any
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdate = useRef(false);
  const pendingPlay = useRef(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!globalThis.window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      globalThis.window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, startSeconds, endSeconds]);

  const initPlayer = () => {
    if (!playerContainerRef.current) return;
    // Destroy existing player if any (though useEffect cleanup handles this usually, but for safety)
    if (playerRef.current) {
      playerRef.current.destroy();
    }

    playerRef.current = new globalThis.window.YT.Player(
      playerContainerRef.current,
      {
        height: "390",
        width: "640",
        videoId: videoId,
        playerVars: {
          start: startSeconds,
          end: endSeconds > 0 ? endSeconds : undefined,
          controls: isHost ? 1 : 0, // Hide controls for non-host
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      },
    );
  };

  // deno-lint-ignore no-explicit-any
  const onPlayerReady = (_event: any) => {
    if (pendingPlay.current) {
      pendingPlay.current = false;
      playerRef.current.playVideo();
    }
  };

  // deno-lint-ignore no-explicit-any
  const onPlayerStateChange = (event: any) => {
    if (!isHost || !socket || isRemoteUpdate.current) return;

    // Sync state changes
    if (event.data === globalThis.window.YT.PlayerState.PLAYING) {
      socket.send(JSON.stringify({
        type: "play_video",
        videoId,
        time: playerRef.current.getCurrentTime(),
      }));
    } else if (event.data === globalThis.window.YT.PlayerState.PAUSED) {
      socket.send(JSON.stringify({
        type: "pause_video",
      }));
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handler = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);

      if (msg.type === "play_video") {
        if (msg.videoId !== videoId) return; // Ignore if for different video

        if (!playerRef.current || !playerRef.current.playVideo) {
          pendingPlay.current = true;
          return;
        }

        isRemoteUpdate.current = true;
        playerRef.current.seekTo(msg.time || 0, true);
        playerRef.current.playVideo();
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 1000); // Reset flag after a delay
      } else if (msg.type === "pause_video") {
        if (!playerRef.current) return;
        isRemoteUpdate.current = true;
        playerRef.current.pauseVideo();
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 500);
      } else if (msg.type === "seek_video") {
        if (!playerRef.current) return;
        isRemoteUpdate.current = true;
        playerRef.current.seekTo(msg.time, true);
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 500);
      }
    };

    socket.addEventListener("message", handler);
    return () => socket.removeEventListener("message", handler);
  }, [socket, isHost, videoId]);

  return (
    <div class="flex flex-col items-center justify-center bg-black p-4 rounded-xl relative">
      <div class="relative">
        <div ref={playerContainerRef} />
        {!isHost && <div class="absolute inset-0 z-10 bg-transparent"></div>}
      </div>
      {!isHost && (
        <div class="mt-4 text-gray-400">
          <p>親が動画を操作しています...</p>
        </div>
      )}
    </div>
  );
}
