import { useState } from "preact/hooks";
import { PublicPlayer, VideoSubmission } from "../utils/game_state.ts";

interface GuessingProps {
  isHost: boolean;
  videos: VideoSubmission[];
  players: PublicPlayer[];
  onSubmitGuess: (videoId: string) => void;
  onSubmitMatch: (matches: { playerId: string; videoId: string }[]) => void;
  myPlayerId: string;
  guesses: { [key: string]: string };
  hostName: string;
}

export function Guessing(
  {
    isHost,
    videos,
    players,
    onSubmitGuess,
    onSubmitMatch,
    myPlayerId,
    guesses,
    hostName,
  }: GuessingProps,
) {
  // Child state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [guessSubmitted, setGuessSubmitted] = useState(false);

  // Host state
  const [matches, setMatches] = useState<Map<string, string>>(new Map()); // playerId -> videoId
  const [matchSubmitted, setMatchSubmitted] = useState(false);

  // Filter out host from players list for matching
  const childPlayers = players.filter((p) => !p.isHost);
  const guessesCount = Object.keys(guesses).length;
  const allChildrenGuessed = guessesCount >= childPlayers.length;

  if (!isHost) {
    // Child View
    if (guessSubmitted || (guesses && guesses[myPlayerId])) {
      return (
        <div class="text-center py-10">
          <h2 class="text-2xl font-bold mb-4">予想を提出しました！</h2>
          <p class="text-gray-400">親の回答と結果発表を待っています...</p>
        </div>
      );
    }

    return (
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold mb-6 text-center">
          {hostName}さんが選んだ動画はどれ？
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {videos.map((v, i) => {
            const isMyVideo = v.playerId === myPlayerId;
            return (
              <button
                key={i}
                type="button"
                disabled={isMyVideo}
                onClick={() => !isMyVideo && setSelectedIndex(i)}
                class={`p-4 rounded-xl border-2 transition relative overflow-hidden group ${
                  isMyVideo
                    ? "border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed"
                    : selectedIndex === i
                    ? "border-purple-500 bg-purple-900/30"
                    : "border-gray-700 bg-gray-800 hover:border-gray-500"
                }`}
              >
                <div class="aspect-video bg-black mb-3 rounded-lg flex items-center justify-center text-gray-500 overflow-hidden relative">
                  {v.thumbnailUrl
                    ? (
                      <img
                        src={v.thumbnailUrl}
                        alt="Thumbnail"
                        class="w-full h-full object-cover"
                      />
                    )
                    : <span class="text-2xl font-bold">Video {i + 1}</span>}
                  {isMyVideo && (
                    <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span class="text-white font-bold text-sm bg-gray-700 px-2 py-1 rounded">
                        あなたの動画
                      </span>
                    </div>
                  )}
                </div>
                <p class="font-bold text-center truncate px-2">
                  {v.title || `動画 ${i + 1}`}
                </p>
                <p class="text-xs text-center text-gray-400">
                  {v.startSeconds}s -{" "}
                  {v.endSeconds > 0 ? v.endSeconds + "s" : "End"}
                </p>
              </button>
            );
          })}
        </div>
        <div class="mt-8 text-center">
          <button
            type="button"
            disabled={selectedIndex === null}
            onClick={() => {
              if (selectedIndex !== null) {
                onSubmitGuess(videos[selectedIndex].videoId);
                setGuessSubmitted(true);
              }
            }}
            class={`px-8 py-3 rounded-lg font-bold text-lg transition ${
              selectedIndex !== null
                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            決定
          </button>
        </div>
      </div>
    );
  } else {
    // Host View
    if (matchSubmitted) {
      return (
        <div class="text-center py-10">
          <h2 class="text-2xl font-bold mb-4">マッチングを提出しました！</h2>
          <p class="text-gray-400">結果発表へ進みます...</p>
        </div>
      );
    }

    return (
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold mb-6 text-center">
          誰がどの動画を選んだ？
        </h2>
        <div class="space-y-6">
          {childPlayers.map((p) => (
            <div
              key={p.id}
              class="bg-gray-800 p-4 rounded-xl flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center font-bold">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <span class="font-bold text-lg">{p.name}</span>
                  {p.id === myPlayerId && (
                    <span class="text-xs text-gray-400 ml-2">(あなた)</span>
                  )}
                </div>
              </div>
              <div class="flex-1 ml-8">
                <select
                  value={matches.get(p.id) || ""}
                  onChange={(e) => {
                    const newMatches = new Map(matches);
                    newMatches.set(p.id, e.currentTarget.value);
                    setMatches(newMatches);
                  }}
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">動画を選択...</option>
                  {videos.filter((v) => v.playerId !== myPlayerId).map((
                    v,
                    i,
                  ) => (
                    <option key={v.videoId} value={v.videoId}>
                      {v.title || `動画 ${i + 1}`} ({v.startSeconds}s -{" "}
                      {v.endSeconds > 0 ? v.endSeconds + "s" : "End"})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div class="mt-8 text-center">
          <p class="text-sm text-gray-400 mb-2">
            子の予想提出状況: {guessesCount} / {childPlayers.length}
          </p>
          <button
            type="button"
            disabled={matches.size < childPlayers.length || !allChildrenGuessed}
            onClick={() => {
              const matchesArray = Array.from(matches.entries()).map((
                [pid, vid],
              ) => ({
                playerId: pid,
                videoId: vid,
              }));
              onSubmitMatch(matchesArray);
              setMatchSubmitted(true);
            }}
            class={`px-8 py-3 rounded-lg font-bold text-lg transition ${
              matches.size === childPlayers.length && allChildrenGuessed
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transform hover:scale-105"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            結果発表へ
          </button>
        </div>
      </div>
    );
  }
}
