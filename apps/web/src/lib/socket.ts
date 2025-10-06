import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type UserRef = {
  id: number;
  username: string;
  token?: string;
};

type SocketHook = {
  socket: Socket | null;
  connected: boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
};

const wsPath = import.meta.env.VITE_WS_URL || '/socket.io';

export function useSocket(gameId: number | null, user?: UserRef | null): SocketHook {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!gameId || !user?.id) {
      setConnected(false);
      return;
    }

    const query: Record<string, string> = {
      gameId: String(gameId),
      userId: String(user.id),
      username: user.username
    };

    if (user.token) {
      query.token = user.token;
    }

    const socket = io('/game', {
      path: wsPath,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      query
    });

    socketRef.current = socket;

    const sendHello = () => {
      socket.emit('hello', {
        gameId,
        userId: user.id,
        username: user.username,
        token: user.token
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      sendHello();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error', err);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [gameId, user?.id, user?.username, user?.token]);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    on,
    off
  };
}
