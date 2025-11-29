import { Handlers } from "$fresh/server.ts";
import {
  createRoom,
  GameMessage,
  getPublicState,
  getRoom,
  joinRoom,
  removePlayer,
  rooms,
} from "../../utils/game_state.ts";

export const handler: Handlers = {
  GET(req) {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response(null, { status: 501 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log("Connected to client");
    };

    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as GameMessage;
        handleMessage(socket, msg);
      } catch (err) {
        console.error("Failed to parse message:", err);
      }
    };

    socket.onclose = () => {
      console.log("Client disconnected");
      // Find the player associated with this socket
      for (const [rid, room] of rooms) {
        for (const [pid, p] of room.players) {
          if (p.socket === socket) {
            const roomDeleted = removePlayer(rid, pid);
            if (!roomDeleted) {
              broadcast(rid, { type: "player_left", playerId: pid });
              broadcastState(rid);
            }
            return;
          }
        }
      }
    };

    socket.onerror = (e) => {
      console.error("WebSocket error:", e);
    };

    return response;
  },
};

function handleMessage(socket: WebSocket, msg: GameMessage) {
  let info: { roomId: string; playerId: string } | null = null;
  if (msg.type !== "join") {
    for (const [rid, room] of rooms) {
      for (const [pid, p] of room.players) {
        if (p.socket === socket) {
          info = { roomId: rid, playerId: pid };
          break;
        }
      }
      if (info) break;
    }
  }

  switch (msg.type) {
    case "join": {
      let room = getRoom(msg.roomId);
      if (!room) {
        const newRoom = createRoom(msg.roomId, msg.playerName);
        room = newRoom;
        const host = newRoom.players.get(newRoom.hostId);
        if (host) {
          host.socket = socket;
        }
        broadcastState(msg.roomId);
      } else {
        if (room.phase !== "LOBBY") {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              type: "error",
              message: "Game has already started",
            }));
          }
          return;
        }
        const player = joinRoom(msg.roomId, msg.playerName, socket);
        if (player) {
          broadcastState(msg.roomId);
        }
      }
      break;
    }

    case "update_settings": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId) {
        room.settings = { ...room.settings, ...msg.settings };
        if (room.phase === "ROUND_SETTINGS") {
          room.phase = "VIDEO_SELECTION";
        }
        broadcastState(info.roomId);
      }
      break;
    }

    case "start_game": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId && room.phase === "LOBBY") {
        room.currentRound = 1;
        room.phase = "ROUND_SETTINGS";
        broadcastState(info.roomId);
      }
      break;
    }

    case "submit_video": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.phase === "VIDEO_SELECTION") {
        const existingIndex = room.videos.findIndex((v) =>
          v.playerId === info!.playerId
        );
        if (existingIndex >= 0) {
          room.videos[existingIndex] = msg.video;
        } else {
          room.videos.push(msg.video);
        }

        if (room.videos.length === room.players.size) {
          // Shuffle videos
          for (let i = room.videos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [room.videos[i], room.videos[j]] = [room.videos[j], room.videos[i]];
          }

          room.phase = "WATCHING";
          if (room.videos.length > 0) {
            room.currentVideoId = room.videos[0].videoId;
            room.currentVideoPlayerId = room.videos[0].playerId;
          }
        }
        broadcastState(info.roomId);
      }
      break;
    }

    case "play_video": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId) {
        console.log(
          `[play_video] Request from host: videoId=${msg.videoId}, ownerId=${msg.ownerId}`,
        );

        let targetOwnerId = msg.ownerId;
        if (!targetOwnerId) {
          // Fallback: find video owner by ID (first match)
          const video = room.videos.find((v) => v.videoId === msg.videoId);
          if (video) targetOwnerId = video.playerId;
        }

        let stateChanged = false;

        if (room.currentVideoId !== msg.videoId) {
          room.currentVideoId = msg.videoId;
          stateChanged = true;
        }

        if (targetOwnerId && room.currentVideoPlayerId !== targetOwnerId) {
          room.currentVideoPlayerId = targetOwnerId;
          stateChanged = true;
        }

        if (stateChanged) {
          console.log(
            `[play_video] State updated: currentVideoId=${room.currentVideoId}, currentVideoPlayerId=${room.currentVideoPlayerId}`,
          );
          broadcastState(info.roomId);
          return;
        }

        broadcast(info.roomId, msg);
      }
      break;
    }

    case "pause_video":
    case "seek_video": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId) {
        broadcast(info.roomId, msg);
      }
      break;
    }

    case "start_guessing": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId && room.phase === "WATCHING") {
        room.phase = "GUESSING";
        broadcastState(info.roomId);
      }
      break;
    }

    case "submit_guess": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.phase === "GUESSING") {
        room.guesses.set(info.playerId, msg.guess.videoId);
        broadcastState(info.roomId);
      }
      break;
    }

    case "submit_match": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId && room.phase === "GUESSING") {
        const childrenCount = room.players.size - 1;
        if (room.guesses.size < childrenCount) {
          return;
        }

        room.matches = new Map();
        for (const match of msg.matches) {
          room.matches.set(match.playerId, match.videoId);
        }

        const hostVideo = room.videos.find((v) => v.playerId === room.hostId);
        if (hostVideo) {
          const children = Array.from(room.players.values()).filter((p) =>
            !p.isHost
          );
          let correctGuessersCount = 0;
          const voteCounts = new Map<string, number>();

          for (const [pid, videoId] of room.guesses) {
            voteCounts.set(videoId, (voteCounts.get(videoId) || 0) + 1);
            if (videoId === hostVideo.videoId) {
              correctGuessersCount++;
              const player = room.players.get(pid);
              if (player) {
                player.score += room.settings.points.guessCorrect;
              }
            }
          }

          const allChildrenGuessedCorrectly =
            correctGuessersCount === children.length && children.length > 0;

          for (const video of room.videos) {
            const votes = voteCounts.get(video.videoId) || 0;
            if (votes > 0) {
              if (
                video.playerId === room.hostId && allChildrenGuessedCorrectly
              ) {
                continue;
              }
              const owner = room.players.get(video.playerId);
              if (owner) {
                owner.score += votes * room.settings.points.voteReceived;
              }
            }
          }

          for (const [pid, videoId] of room.matches) {
            const childVideo = room.videos.find((v) => v.playerId === pid);
            if (childVideo && childVideo.videoId === videoId) {
              const host = room.players.get(room.hostId);
              if (host) {
                host.score += room.settings.points.hostMatch;
              }
            }
          }
        }

        room.phase = "RESULTS";
        broadcastState(info.roomId);
      }
      break;
    }

    case "next_round": {
      if (!info) return;
      const room = getRoom(info.roomId);
      if (room && room.hostId === info.playerId && room.phase === "RESULTS") {
        const playerIds = Array.from(room.players.keys());
        const currentHostIndex = playerIds.indexOf(room.hostId);
        const nextHostIndex = (currentHostIndex + 1) % playerIds.length;

        if (room.currentRound >= playerIds.length) {
          room.phase = "GAME_OVER";
        } else {
          const nextHostId = playerIds[nextHostIndex];
          const oldHost = room.players.get(room.hostId);
          if (oldHost) oldHost.isHost = false;

          const newHost = room.players.get(nextHostId);
          if (newHost) newHost.isHost = true;

          room.hostId = nextHostId;
          room.currentRound += 1;
          room.phase = "ROUND_SETTINGS";

          room.videos = [];
          room.guesses = new Map();
          room.matches = new Map();
          room.currentVideoId = undefined;
          room.currentVideoPlayerId = undefined;
        }

        broadcastState(info.roomId);
      }
      break;
    }
  }
}

function broadcastState(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;

  for (const [pid, player] of room.players) {
    if (player.socket && player.socket.readyState === WebSocket.OPEN) {
      const publicState = getPublicState(room, pid);
      player.socket.send(JSON.stringify({
        type: "state_update",
        state: publicState,
      }));
    }
  }
}

function broadcast(roomId: string, msg: unknown) {
  const room = getRoom(roomId);
  if (!room) return;

  for (const [_, player] of room.players) {
    if (player.socket && player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(JSON.stringify(msg));
    }
  }
}
