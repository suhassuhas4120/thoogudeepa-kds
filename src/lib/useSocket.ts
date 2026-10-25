'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

export function getClientSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionAttempts: Infinity,
    });
  }
  return globalSocket;
}

/**
 * Enhanced useSocketRoom Hook
 * Guarantees Room Join ACK before or during state re-hydration to permanently
 * eliminate WebSocket vs HTTP fetch race conditions during browser reloads.
 */
export function useSocketRoom(
  roomName?: string,
  onSyncReady?: () => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getClientSocket();
    socketRef.current = socket;

    const performSafeJoinAndSync = () => {
      if (!roomName) return;
      socket.emit('join', { room: roomName }, (response: { success: boolean }) => {
        if (response?.success && onSyncReady) {
          onSyncReady();
        }
      });
    };

    if (roomName) {
      if (socket.connected) {
        performSafeJoinAndSync();
      } else {
        socket.once('connect', performSafeJoinAndSync);
      }

      // Handle reconnect events seamlessly
      socket.on('reconnect', performSafeJoinAndSync);
    }

    return () => {
      if (roomName && socket.connected) {
        socket.emit('leave', { room: roomName });
        socket.off('reconnect', performSafeJoinAndSync);
      }
    };
  }, [roomName, onSyncReady]);

  return socketRef.current || getClientSocket();
}
