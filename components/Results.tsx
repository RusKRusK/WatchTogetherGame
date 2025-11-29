import { PublicRoom } from "../utils/game_state.ts";

interface ResultsProps {
  room: PublicRoom;
  isHost: boolean;
  onNextRound: () => void;
}

export function Results({ room, isHost, onNextRound }: ResultsProps) {
  // Calculate results locally for display (or server could send detailed results)
  // We have room.guesses (Child -> VideoId) and room.matches (Host -> Child -> VideoId)
  // We also have room.videos (VideoId -> PlayerId (hidden in public state?))
  // Wait, in RESULTS phase, we should expose who submitted which video.
  // I need to update getPublicState to expose playerId in videos during RESULTS.

  // Assuming room.videos has playerId in RESULTS phase.

  const hostVideo = room.videos.find((v) => v.playerId === room.hostId);

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      <h2 class="text-3xl font-bold text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
        結果発表
      </h2>

      {/* 1. Parent's Video Reveal */}
      <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 class="text-xl font-bold mb-4 text-purple-400">親の選んだ動画</h3>
        {hostVideo
          ? (
            <div class="flex items-center gap-4 bg-gray-900 p-4 rounded-lg">
              <div class="font-bold text-lg truncate flex-1">
                {hostVideo.title ||
                  `動画 ${
                    room.videos.findIndex((v) =>
                      v.videoId === hostVideo.videoId
                    ) + 1
                  }`}
              </div>
              <a
                href={`https://youtu.be/${hostVideo.videoId}`}
                target="_blank"
                class="text-blue-400 hover:underline truncate flex-1"
              >
                https://youtu.be/{hostVideo.videoId}
              </a>
            </div>
          )
          : <p>親の動画が見つかりません</p>}

        <div class="mt-4">
          <h4 class="font-bold mb-2 text-gray-400">正解者</h4>
          <ul class="flex flex-wrap gap-2">
            {room.players.filter((p) => !p.isHost).map((p) => {
              const guess = room.guesses?.[p.id];
              const isCorrect = guess === hostVideo?.videoId;
              if (!isCorrect) return null;
              return (
                <li
                  key={p.id}
                  class="bg-green-900 text-green-300 px-3 py-1 rounded-full text-sm font-bold"
                >
                  {p.name} (+{room.settings.points.guessCorrect}pt)
                </li>
              );
            })}
            {room.players.filter((p) =>
                  !p.isHost && room.guesses?.[p.id] !== hostVideo?.videoId
                ).length === room.players.length - 1 && (
              <li class="text-gray-500 italic">正解者なし</li>
            )}
          </ul>
        </div>
      </div>

      {/* 2. Who chose what? */}
      <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 class="text-xl font-bold mb-4 text-blue-400">みんなの動画</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {room.videos.map((v, i) => { // Show ALL videos including host's
            const player = room.players.find((p) => p.id === v.playerId);
            const videoIndex = room.videos.findIndex((rv) =>
              rv.videoId === v.videoId
            ) + 1;

            // Did host guess this correctly? (Only for children)
            const isChild = player?.id !== room.hostId;
            const hostGuessForThisChild = isChild
              ? room.matches?.[player?.id || ""]
              : null;
            const isHostCorrect = isChild &&
              hostGuessForThisChild === v.videoId;

            // Votes received
            const votes = Object.values(room.guesses || {}).filter((gid) =>
              gid === v.videoId
            ).length;

            // Check if host got 0 points due to all correct
            const isHostVideo = player?.id === room.hostId;
            const childrenCount = room.players.length - 1;
            const correctGuesses =
              Object.values(room.guesses || {}).filter((gid) =>
                gid === hostVideo?.videoId
              ).length;
            const allCorrect = correctGuesses === childrenCount &&
              childrenCount > 0;
            const hostGotPoints = isHostVideo ? !allCorrect : true;

            return (
              <div
                key={i}
                class="bg-gray-900 p-4 rounded-lg flex items-center justify-between"
              >
                <div class="flex-1 min-w-0 mr-4">
                  <span class="font-bold text-lg text-gray-300 truncate block">
                    {v.title || `動画 ${videoIndex}`}
                  </span>
                  <div class="text-sm text-gray-500 mt-1">
                    by{" "}
                    <span class="text-white font-bold">
                      {player?.name || "Unknown"}
                    </span>
                    {isHostVideo && (
                      <span class="ml-2 text-yellow-500 text-xs border border-yellow-500 px-1 rounded">
                        HOST
                      </span>
                    )}
                  </div>
                </div>
                <div class="text-right">
                  {isChild && (
                    <div class="mb-1">
                      {isHostCorrect
                        ? (
                          <span class="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs font-bold block">
                            親的中 (+{room.settings.points.hostMatch})
                          </span>
                        )
                        : (
                          <span class="text-red-500 text-xs block">
                            親ハズレ
                          </span>
                        )}
                    </div>
                  )}
                  <div class="text-xs text-gray-400">
                    {votes} 票
                    {votes > 0 && (
                      hostGotPoints
                        ? (
                          <span class="text-green-400 ml-1">
                            (+{votes * room.settings.points.voteReceived})
                          </span>
                        )
                        : <span class="text-red-400 ml-1">(0pt: 全員正解)</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Scores */}
      <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 class="text-xl font-bold mb-4 text-yellow-400">現在のスコア</h3>
        <ul class="space-y-2">
          {room.players.sort((a, b) => b.score - a.score).map((p, i) => (
            <li
              key={p.id}
              class="flex items-center justify-between bg-gray-700 p-3 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <span class="font-bold text-gray-400 w-6">#{i + 1}</span>
                <span class="font-bold">{p.name}</span>
                {p.isHost && (
                  <span class="text-xs bg-yellow-600 px-2 py-0.5 rounded">
                    HOST
                  </span>
                )}
              </div>
              <span class="font-bold text-xl text-yellow-500">{p.score}pt</span>
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div class="text-center mt-8">
          <button
            type="button"
            onClick={onNextRound}
            class="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg font-bold text-lg transform hover:scale-105 transition"
          >
            次のラウンドへ
          </button>
        </div>
      )}
    </div>
  );
}
