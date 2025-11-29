import { useSignal } from "@preact/signals";

export default function HomeIsland() {
  const roomIdInput = useSignal("");

  const createRoom = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let roomId = "";
    for (let i = 0; i < 5; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    globalThis.window.location.href = `/room/${roomId}`;
  };

  const joinRoom = () => {
    if (roomIdInput.value) {
      globalThis.window.location.href =
        `/room/${roomIdInput.value.toUpperCase()}`;
    }
  };

  return (
    <div class="bg-gray-800 p-8 rounded-xl shadow-lg space-y-6 border border-gray-700">
      <div class="space-y-4">
        <button
          type="button"
          onClick={createRoom}
          class="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition duration-200 transform hover:scale-105"
        >
          ルームを作成する
        </button>
      </div>

      <div class="relative">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-600"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-gray-800 text-gray-400">または</span>
        </div>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-400 mb-1">
            ルームIDを入力して参加
          </label>
          <div class="flex gap-2">
            <input
              type="text"
              value={roomIdInput}
              onInput={(e) => roomIdInput.value = e.currentTarget.value}
              class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
              placeholder="ABCDE"
            />
            <button
              type="button"
              onClick={joinRoom}
              class="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition duration-200"
            >
              参加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
