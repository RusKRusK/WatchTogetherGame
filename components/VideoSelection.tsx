import { useState } from "preact/hooks";
import { VideoSubmission } from "../utils/game_state.ts";

interface VideoSelectionProps {
  onSubmit: (video: VideoSubmission) => void;
  playerId: string;
  theme: string;
  maxDuration: number;
}

export function VideoSelection(
  { onSubmit, playerId, theme, maxDuration }: VideoSelectionProps,
) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [isValid, setIsValid] = useState(false);

  const extractVideoId = (inputUrl: string) => {
    let videoId = "";
    try {
      const u = new URL(inputUrl);
      if (u.hostname === "youtu.be") {
        videoId = u.pathname.slice(1);
      } else if (u.hostname.includes("youtube.com")) {
        videoId = u.searchParams.get("v") || "";
      }
    } catch {
      // invalid url
    }
    return videoId;
  };

  const handlePreview = () => {
    const vid = extractVideoId(url);
    if (vid) {
      setPreviewId(vid);
      setIsValid(true);
    } else {
      alert("有効なYouTube URLを入力してください");
    }
  };

  const handleSubmit = () => {
    if (!isValid) {
      alert("動画の確認（プレビュー）を行ってください");
      return;
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
      alert("有効なYouTube URLを入力してください");
      return;
    }

    if (!title) {
      alert("動画のタイトル（または説明）を入力してください");
      return;
    }

    // Parse time (simple mm:ss or seconds)
    const parseTime = (str: string) => {
      if (!str) return 0;
      const parts = str.split(":").map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      return Number(str) || 0;
    };

    const start = parseTime(startStr);
    let end = parseTime(endStr);

    // Validate time range
    if (end > 0 && end <= start) {
      alert("終了時間は開始時間より後に設定してください");
      return;
    }

    // Enforce max duration
    if (maxDuration > 0) {
      if (end === 0) {
        // If no end time specified, set it to start + maxDuration
        end = start + maxDuration;
      } else {
        const duration = end - start;
        if (duration > maxDuration) {
          alert(
            `動画の長さが制限（${maxDuration}秒）を超えています。\n終了時間を調整するか、空欄にして自動設定してください。`,
          );
          return;
        }
      }
    }

    const submission: VideoSubmission = {
      playerId,
      videoId,
      startSeconds: start,
      endSeconds: end || 0, // 0 means no limit/end of video (unless maxDuration forced it)
      title: title,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };

    onSubmit(submission);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div class="text-center py-10">
        <h2 class="text-2xl font-bold mb-4">提出完了！</h2>
        <p class="text-gray-400">他のプレイヤーの提出を待っています...</p>
      </div>
    );
  }

  return (
    <div class="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
      <div class="mb-8 text-center">
        <h2 class="text-2xl font-bold mb-2">動画を選択してください</h2>
        {(theme || maxDuration > 0) && (
          <div class="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4 inline-block text-left">
            {theme && <p class="text-purple-200 font-bold">テーマ: {theme}</p>}
            {maxDuration > 0 && (
              <p class="text-gray-300 text-sm">
                ⏱️ 制限時間: {maxDuration}秒以内
              </p>
            )}
          </div>
        )}
      </div>

      <div class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1">
            YouTube URL
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              value={url}
              onInput={(e) => setUrl(e.currentTarget.value)}
              class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="https://www.youtube.com/watch?v=..."
            />
            <button
              type="button"
              onClick={handlePreview}
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold border border-gray-600"
            >
              確認
            </button>
          </div>
        </div>

        {previewId && (
          <div class="aspect-video bg-black rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${previewId}`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            >
            </iframe>
          </div>
        )}

        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1">
            動画タイトル / 説明 (みんなに表示されます)
          </label>
          <input
            type="text"
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="例: あの伝説のライブ映像"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1">
              開始時間 (オプション)
            </label>
            <input
              type="text"
              value={startStr}
              onInput={(e) => setStartStr(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="0:00"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1">
              終了時間 ({maxDuration > 0 ? "自動設定可" : "オプション"})
            </label>
            <input
              type="text"
              value={endStr}
              onInput={(e) => setEndStr(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={maxDuration > 0 ? `+${maxDuration}秒` : "5:00"}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          class="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition duration-200 transform hover:scale-105"
        >
          決定
        </button>
      </div>
    </div>
  );
}
