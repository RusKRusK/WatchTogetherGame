export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  socket?: WebSocket;
}

export interface Room {
  id: string;
  players: Map<string, Player>;
  phase: GamePhase;
  settings: GameSettings;
  videos: VideoSubmission[];
  currentRound: number;
  hostId: string;
  currentVideoId?: string;
  currentVideoPlayerId?: string;
  guesses: Map<string, string>; // playerId -> videoId
  matches: Map<string, string>; // hostId -> (playerId -> videoId JSON)
}

export type GamePhase =
  | "LOBBY"
  | "ROUND_SETTINGS"
  | "VIDEO_SELECTION"
  | "WATCHING"
  | "GUESSING"
  | "RESULTS"
  | "GAME_OVER";

export interface GameSettings {
  maxVideoDurationSec: number; // 0 for unlimited
  theme: string;
  points: {
    guessCorrect: number;
    voteReceived: number;
    hostMatch: number;
  };
}

export interface VideoSubmission {
  playerId: string;
  videoId: string; // YouTube Video ID
  startSeconds: number;
  endSeconds: number;
  title?: string;
  thumbnailUrl?: string;
}

// Public types for JSON serialization
export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
}

export interface PublicRoom {
  id: string;
  players: PublicPlayer[];
  phase: GamePhase;
  settings: GameSettings;
  videos: VideoSubmission[];
  currentRound: number;
  hostId: string;
  currentVideoId?: string;
  currentVideoPlayerId?: string;
  guesses?: { [key: string]: string };
  matches?: { [key: string]: string };
}

// In-memory storage for rooms
export const rooms = new Map<string, Room>();

export function createRoom(roomId: string, hostName: string): Room {
  const hostId = crypto.randomUUID();
  const host: Player = {
    id: hostId,
    name: hostName,
    isHost: true,
    score: 0,
  };

  const room: Room = {
    id: roomId,
    players: new Map([[hostId, host]]),
    phase: "LOBBY",
    settings: {
      maxVideoDurationSec: 300, // 5 minutes
      theme: "",
      points: {
        guessCorrect: 10,
        voteReceived: 5,
        hostMatch: 5,
      },
    },
    videos: [],
    currentRound: 0,
    hostId: hostId,
    currentVideoId: undefined,
    currentVideoPlayerId: undefined,
    guesses: new Map(),
    matches: new Map(),
  };

  rooms.set(roomId, room);
  return room;
}

export function joinRoom(
  roomId: string,
  playerName: string,
  socket: WebSocket,
): Player | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const playerId = crypto.randomUUID();
  const player: Player = {
    id: playerId,
    name: playerName,
    isHost: false,
    score: 0,
    socket,
  };

  room.players.set(playerId, player);
  return player;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function removePlayer(roomId: string, playerId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  room.players.delete(playerId);

  if (room.players.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
    return true; // Room deleted
  }
  return false; // Room still active
}

// WebSocket Message Types
export type GameMessage =
  | { type: "join"; roomId: string; playerName: string }
  | { type: "update_settings"; settings: GameSettings }
  | { type: "start_game" }
  | { type: "submit_video"; video: VideoSubmission }
  | { type: "play_video"; videoId: string; ownerId?: string; time?: number } // Parent controls
  | { type: "pause_video" }
  | { type: "seek_video"; time: number }
  | { type: "start_guessing" }
  | { type: "submit_guess"; guess: { videoId: string } } // Child guessing parent's video
  | { type: "submit_match"; matches: { playerId: string; videoId: string }[] } // Parent matching children
  | { type: "next_round" }
  | { type: "state_update"; state: PublicRoom }
  | { type: "player_left"; playerId: string };

export interface WsEvent {
  event: string;
  data: unknown;
}

export function getPublicState(room: Room, _playerId: string): PublicRoom {
  // Clone room to avoid mutating original
  const publicRoom = JSON.parse(JSON.stringify(room));

  const players: PublicPlayer[] = [];
  for (const [_, p] of room.players) {
    players.push({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      score: p.score,
    });
  }

  const publicState: PublicRoom = {
    ...publicRoom,
    players: players,
    videos: room.videos.map((v: VideoSubmission) => {
      // Hide playerId during WATCHING and GUESSING, unless it's the host OR it's my own video
      if (
        (room.phase === "WATCHING" || room.phase === "GUESSING") &&
        _playerId !== room.hostId &&
        v.playerId !== _playerId
      ) {
        return {
          ...v,
          playerId: undefined,
        };
      }
      return v;
    }),
    currentVideoPlayerId:
      (room.phase === "WATCHING" || room.phase === "GUESSING") &&
        _playerId !== room.hostId
        ? undefined
        : room.currentVideoPlayerId,
    guesses: (room.phase === "RESULTS" || room.phase === "GUESSING")
      ? Object.fromEntries(
        Array.from(room.guesses.entries()).map(([pid, vid]) => {
          if (room.phase === "RESULTS") return [pid, vid];
          // During GUESSING
          if (pid === _playerId) return [pid, vid]; // Show my own guess
          return [pid, "guessed"]; // Hide others' guesses
        }),
      )
      : undefined,
    matches: room.phase === "RESULTS"
      ? Object.fromEntries(room.matches)
      : undefined,
  };

  return publicState;
}
