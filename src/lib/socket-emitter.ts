import { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer | undefined;
}

export type SocketRoom =
  | 'room:kitchen'
  | 'room:waiter:zoneA'
  | 'room:waiter:zoneB'
  | 'room:waiter:all'
  | 'room:manager'
  | 'room:global'
  | `room:seat:${number}`;

export function emitToRoom(room: SocketRoom, event: string, payload: unknown) {
  if (global.io) {
    global.io.to(room).emit(event, payload);
  }
}

export function emitToMultipleRooms(rooms: SocketRoom[], event: string, payload: unknown) {
  if (global.io) {
    rooms.forEach((room) => {
      global.io?.to(room).emit(event, payload);
    });
  }
}
