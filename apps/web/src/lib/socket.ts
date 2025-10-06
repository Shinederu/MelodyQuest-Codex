import { io, Socket } from "socket.io-client";
import { api } from "./http";

export type UserInfo = { id: number; username: string; token?: string };

export async function getGuestToken(user: {id:number; username:string}) {
  const r = await api.post<{token:string}>("/token/guest", { user_id: user.id, username: user.username });
  if (!r.ok || !r.data?.token) throw new Error("guest token failed");
  return r.data.token;
}

export async function connectGameSocket(basePath: string, gameId: number, user: UserInfo): Promise<Socket> {
  const token = user.token ?? await getGuestToken(user);
  const trimmed = basePath.trim();
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const sanitized = trimmed.replace(/\/$/, '');
  const target = sanitized && isAbsolute ? `${sanitized}/game` : '/game';
  const pathOption = !isAbsolute && sanitized ? sanitized : undefined;
  const socket = io(target, {
    transports: ["websocket", "polling"],
    autoConnect: false,
    ...(pathOption ? { path: pathOption } : {}),
    query: {
      gameId: String(gameId),
      userId: String(user.id),
      username: user.username,
      token
    }
  });
  socket.connect();
  socket.emit("hello", { gameId, userId: user.id, username: user.username, token });
  return socket;
}
