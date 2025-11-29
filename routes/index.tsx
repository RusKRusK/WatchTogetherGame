import HomeIsland from "../islands/Home.tsx";

export default function Home() {
  return (
    <div class="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Watch Toguesser
          </h1>
          <p class="text-gray-400">
            試験中
          </p>
        </div>
        <HomeIsland />
      </div>
    </div>
  );
}
