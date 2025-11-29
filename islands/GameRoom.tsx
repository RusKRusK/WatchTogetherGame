import { useEffect, useState } from "preact/hooks";
import { PublicRoom, VideoSubmission } from "../utils/game_state.ts";
import { VideoSelection } from "../components/VideoSelection.tsx";
import { VideoPlayer } from "../components/VideoPlayer.tsx";
import { Guessing } from "../components/Guessing.tsx";
import { Results } from "../components/Results.tsx";

interface GameRoomProps {
  roomId: string;
}

export default function GameRoom({ roomId }: GameRoomProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [_connected, setConnected] = useState(false);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!joined || !playerName) return;

    const protocol = globalThis.window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
    const wsUrl = `${protocol}//${globalThis.window.location.host}/api/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to WS");
      setConnected(true);
      ws.send(JSON.stringify({
        type: "join",
        roomId,
        playerName,
      }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "state_update") {
        setRoom(msg.state);
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from WS");
      setConnected(false);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [joined, roomId, playerName]);

  const submitVideo = (video: VideoSubmission) => {
    socket?.send(JSON.stringify({
      type: "submit_video",
      video,
    }));
  };

  const playVideo = (videoId: string, ownerId: string, startSeconds = 0) => {
    socket?.send(JSON.stringify({
      type: "play_video",
      videoId,
      ownerId,
      time: startSeconds,
    }));
  };

  const submitGuess = (videoId: string) => {
    socket?.send(JSON.stringify({
      type: "submit_guess",
      guess: { videoId },
    }));
  };

  const submitMatch = (matches: { playerId: string; videoId: string }[]) => {
    socket?.send(JSON.stringify({
      type: "submit_match",
      matches,
    }));
  };

  const nextRound = () => {
    socket?.send(JSON.stringify({
      type: "next_round",
    }));
  };

  if (!joined) {
    return (
      <div class="flex items-center justify-center h-screen">
        <div class="bg-gray-800 p-8 rounded-xl shadow-lg space-y-4">
          <h2 class="text-2xl font-bold text-center">ルームに参加</h2>
          <input
            type="text"
            value={playerName}
            onInput={(e) => setPlayerName(e.currentTarget.value)}
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="名前を入力"
          />
          <button
            type="button"
            onClick={() => {
              if (playerName) setJoined(true);
            }}
            class="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold"
          >
            参加する
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div class="flex items-center justify-center h-screen">
        <p>Loading room...</p>
      </div>
    );
  }

  const myPlayerId = room.players.find((p) => p.name === playerName)?.id || "";
  const isHost = room.hostId === myPlayerId;
  const currentVideo = room.videos.find((v) =>
    room.currentVideoPlayerId
      ? v.playerId === room.currentVideoPlayerId
      : v.videoId === room.currentVideoId
  );

  return (
    <div class="p-4 max-w-6xl mx-auto">
      <header class="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <div>
          <h1 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Watch Toguesser
          </h1>
          <div class="flex items-center gap-2 mt-1">
            <p class="text-sm text-gray-400">
              Room: <span class="font-mono font-bold text-white">{roomId}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(roomId);
                alert("Room ID copied!");
              }}
              class="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 transition"
              title="Copy Room ID"
            >
              Copy
            </button>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold">{playerName}</p>
          <p class="text-sm text-yellow-400 font-bold mb-1">
            Host: {room.players.find((p) => p.isHost)?.name}
          </p>
          <p class="text-sm text-gray-400">
            {room.phase} - Round {room.currentRound}
          </p>
        </div>
      </header>

      {/* Scoreboard */}
      <div class="mb-6 bg-gray-800 p-4 rounded-lg flex flex-wrap gap-4 items-center justify-center border border-gray-700">
        {room.players.sort((a, b) => b.score - a.score).map((p, i) => (
          <div key={p.id} class="flex items-center gap-2">
            <span
              class={`font-bold ${
                i === 0 ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              {i + 1}. {p.name}
            </span>
            <span class="bg-gray-700 px-2 py-0.5 rounded text-sm font-mono text-white">
              {p.score}pt
            </span>
          </div>
        ))}
      </div>

      <main>
        {room.phase === "LOBBY" && (
          <Lobby
            room={room}
            socket={socket}
            playerId={myPlayerId}
          />
        )}
        {room.phase === "ROUND_SETTINGS" && (
          <RoundSettings
            room={room}
            isHost={isHost}
            onStart={() =>
              socket?.send(JSON.stringify({
                type: "update_settings",
                settings: {
                  ...room.settings,
                },
              }))}
            socket={socket}
          />
        )}
        {room.phase === "VIDEO_SELECTION" && (
          <VideoSelection
            onSubmit={submitVideo}
            playerId={myPlayerId}
            theme={room.settings.theme}
            maxDuration={room.settings.maxVideoDurationSec}
          />
        )}
        {room.phase === "WATCHING" && (
          <div class="space-y-8">
            {currentVideo
              ? (
                <VideoPlayer
                  key={`${currentVideo.videoId}-${currentVideo.playerId}`}
                  videoId={currentVideo.videoId}
                  startSeconds={currentVideo.startSeconds}
                  endSeconds={currentVideo.endSeconds}
                  isHost={isHost}
                  socket={socket}
                />
              )
              : (
                <div class="text-center py-10 bg-gray-800 rounded-xl">
                  <p class="text-xl text-gray-400">動画を選択してください</p>
                </div>
              )}

            {isHost && (
              <div class="bg-gray-800 p-6 rounded-xl">
                <h3 class="text-lg font-bold mb-4">
                  動画リスト (親のみ操作可能)
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {room.videos.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        playVideo(v.videoId, v.playerId, v.startSeconds)}
                      class={`p-4 rounded-lg border text-left transition ${
                        room.currentVideoPlayerId === v.playerId
                          ? "bg-purple-900 border-purple-500"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                      }`}
                    >
                      <p class="font-bold truncate">
                        {v.title || `動画 ${i + 1}`}
                      </p>
                      <p class="text-xs text-gray-400 mt-1">
                        {v.startSeconds}s -{" "}
                        {v.endSeconds > 0 ? v.endSeconds + "s" : "End"}
                      </p>
                    </button>
                  ))}
                </div>
                <div class="mt-6 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      socket?.send(JSON.stringify({ type: "start_guessing" }))}
                    class="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg font-bold"
                  >
                    予想フェーズへ進む
                  </button>
                </div>
              </div>
            )}
            {!isHost && (
              <div class="text-center text-gray-400">
                <p>親が動画を選んでいます...</p>
              </div>
            )}
          </div>
        )}
        {room.phase === "GUESSING" && (
          <Guessing
            isHost={isHost}
            videos={room.videos}
            players={room.players}
            onSubmitGuess={submitGuess}
            onSubmitMatch={submitMatch}
            myPlayerId={myPlayerId}
            guesses={room.guesses || {}}
            hostName={room.players.find((p) => p.isHost)?.name || "親"}
          />
        )}
        {room.phase === "RESULTS" && (
          <Results
            room={room}
            isHost={isHost}
            onNextRound={nextRound}
          />
        )}
        {room.phase === "GAME_OVER" && (
          <div class="max-w-4xl mx-auto text-center space-y-8">
            <h2 class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-red-500">
              ゲーム終了！
            </h2>
            <div class="bg-gray-800 p-8 rounded-xl shadow-2xl border border-yellow-500/30">
              <h3 class="text-2xl font-bold mb-6">最終結果</h3>
              <ul class="space-y-4">
                {room.players.sort((a, b) => b.score - a.score).map((p, i) => (
                  <li
                    key={p.id}
                    class={`flex items-center justify-between p-4 rounded-lg ${
                      i === 0
                        ? "bg-yellow-900/50 border border-yellow-500"
                        : "bg-gray-700"
                    }`}
                  >
                    <div class="flex items-center gap-4">
                      <span
                        class={`font-bold text-2xl w-8 ${
                          i === 0 ? "text-yellow-400" : "text-gray-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span class="font-bold text-xl">{p.name}</span>
                      {i === 0 && (
                        <span class="text-xs bg-yellow-500 text-black px-2 py-1 rounded font-bold">
                          WINNER
                        </span>
                      )}
                    </div>
                    <span class="font-bold text-2xl text-yellow-500">
                      {p.score}pt
                    </span>
                  </li>
                ))}
              </ul>
              <div class="mt-10">
                <a
                  href="/"
                  class="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-lg transition"
                >
                  ロビーに戻る
                </a>
              </div>
            </div>
          </div>
        )}
        {room.phase !== "LOBBY" && room.phase !== "ROUND_SETTINGS" &&
          room.phase !== "VIDEO_SELECTION" &&
          room.phase !== "WATCHING" && room.phase !== "GUESSING" &&
          room.phase !== "RESULTS" && room.phase !== "GAME_OVER" && (
          <div class="text-center py-20">
            <h2 class="text-3xl font-bold mb-4">Phase: {room.phase}</h2>
            <p>Coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Lobby(
  { room, socket, playerId }: {
    room: PublicRoom;
    socket: WebSocket | null;
    playerId?: string;
  },
) {
  const isHost = room.hostId === playerId;

  const startGame = () => {
    socket?.send(JSON.stringify({ type: "start_game" }));
  };

  return (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="bg-gray-800 p-6 rounded-xl">
        <h2 class="text-xl font-bold mb-4">参加者 ({room.players.length})</h2>
        <ul class="space-y-2">
          {room.players.map((p) => (
            <li key={p.id} class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold">
                {p.name.charAt(0)}
              </div>
              <span>{p.name}</span>
              {p.isHost && (
                <span class="text-xs bg-yellow-600 px-2 py-0.5 rounded">
                  HOST
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div class="bg-gray-800 p-6 rounded-xl">
        <h2 class="text-xl font-bold mb-4">ゲーム設定</h2>
        {isHost
          ? (
            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">テーマ</label>
                <input
                  type="text"
                  value={room.settings.theme}
                  onInput={(e) => {
                    const newSettings = {
                      ...room.settings,
                      theme: e.currentTarget.value,
                    };
                    socket?.send(
                      JSON.stringify({
                        type: "update_settings",
                        settings: newSettings,
                      }),
                    );
                  }}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="例: 懐かしい曲"
                />
              </div>
              <button
                type="button"
                onClick={startGame}
                class="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg font-bold mt-4"
              >
                ゲーム開始
              </button>
            </div>
          )
          : (
            <div class="space-y-4 text-gray-300">
              <p>テーマ: {room.settings.theme || "なし"}</p>
              <p>ホストがゲームを開始するのを待っています...</p>
            </div>
          )}
      </div>
    </div>
  );
}

function RoundSettings(
  { room, isHost, onStart, socket }: {
    room: PublicRoom;
    isHost: boolean;
    onStart: () => void;
    socket: WebSocket | null;
  },
) {
  const [theme, setTheme] = useState(room.settings.theme);
  const [duration, setDuration] = useState(room.settings.maxVideoDurationSec);

  const handleStart = () => {
    socket?.send(JSON.stringify({
      type: "update_settings",
      settings: {
        theme,
        maxVideoDurationSec: duration,
      },
    }));
    // Wait a bit for server to update state? Or just send start_game equivalent?
    // Actually ws.ts says update_settings with ROUND_SETTINGS phase moves to VIDEO_SELECTION.
    // So just sending update_settings is enough.
  };

  if (!isHost) {
    return (
      <div class="text-center py-20">
        <h2 class="text-3xl font-bold mb-4">ラウンド設定中</h2>
        <p class="text-xl mb-4">
          親 ({room.players.find((p) => p.isHost)?.name})
          が次のラウンドの設定をしています...
        </p>
        <div class="animate-pulse bg-gray-700 h-4 w-48 mx-auto rounded"></div>
      </div>
    );
  }

  return (
    <div class="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg border border-purple-500/30">
      <h2 class="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
        ラウンド設定
      </h2>

      <div class="space-y-6">
        <div>
          <label class="block text-lg font-bold mb-2 text-gray-300">
            テーマ (任意)
          </label>
          <input
            type="text"
            value={theme}
            onInput={(e) => setTheme(e.currentTarget.value)}
            placeholder="例: 90年代のアニメOP、泣ける曲..."
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
          />
        </div>

        <div>
          <label class="block text-lg font-bold mb-2 text-gray-300">
            動画の長さ上限 (秒)
          </label>
          <div class="flex items-center gap-4">
            <input
              type="number"
              value={duration}
              onInput={(e) => setDuration(Number(e.currentTarget.value))}
              class="w-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
            <span class="text-gray-400">0 = 無制限</span>
          </div>
        </div>

        <div class="pt-6">
          <button
            onClick={handleStart}
            class="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold text-xl transition transform hover:scale-105 shadow-lg"
          >
            設定を完了して開始
          </button>
        </div>
      </div>
    </div>
  );
}
