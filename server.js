const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Attach Socket.io
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Store io on global for Next.js API routes to access
  global.io = io;

  io.on('connection', (socket) => {
    // Client joins room based on role or seat with ACK guarantee
    socket.on('join', ({ room }, ack) => {
      if (room) {
        socket.join(room);
        console.log(`[Socket] Client ${socket.id} joined room: ${room}`);
        if (typeof ack === 'function') {
          ack({ success: true, room, joinedAt: Date.now() });
        }
      }
    });

    socket.on('leave', ({ room }, ack) => {
      if (room) {
        socket.leave(room);
        console.log(`[Socket] Client ${socket.id} left room: ${room}`);
        if (typeof ack === 'function') {
          ack({ success: true, room });
        }
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> THOOGUDEEPA KDS Server ready on http://localhost:${port}`);
    console.log(`> Real-time Socket.io initialized on http://localhost:${port}`);
  });
});
