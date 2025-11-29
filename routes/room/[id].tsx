import { PageProps } from "$fresh/server.ts";
import GameRoom from "../../islands/GameRoom.tsx";

export default function RoomPage(props: PageProps) {
  const { id } = props.params;
  return (
    <div class="min-h-screen bg-gray-900 text-white">
      <GameRoom roomId={id} />
    </div>
  );
}
