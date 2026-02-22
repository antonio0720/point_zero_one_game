import { Server } from 'socket.io';
import { joinRoom, submitAction, leaveRoom, disconnect } from './events';
import { validateAction } from './validation';
import { mlEnabled, auditHash } from '../config';

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected`);

  socket.on(joinRoom, async ({ roomId }) => {
    if (!mlEnabled) return;

    try {
      const result = await validateAction(socket.handshake.auth.action);
      io.to(roomId).emit(submitAction, { action: result });
    } catch (error) {
      console.error(error);
      io.to(roomId).emit(leaveRoom);
    }
  });

  socket.on(submitAction, async ({ roomId }) => {
    if (!mlEnabled) return;

    try {
      const result = await validateAction(socket.handshake.auth.action);
      io.to(roomId).emit(submitAction, { action: result });
    } catch (error) {
      console.error(error);
      io.to(roomId).emit(leaveRoom);
    }
  });

  socket.on(leaveRoom, async ({ roomId }) => {
    if (!mlEnabled) return;

    try {
      const result = await validateAction(socket.handshake.auth.action);
      io.to(roomId).emit(submitAction, { action: result });
    } catch (error) {
      console.error(error);
      io.to(roomId).emit(leaveRoom);
    }
  });

  socket.on(disconnect, async () => {
    if (!mlEnabled) return;

    try {
      const result = await validateAction(socket.handshake.auth.action);
      io.to(socket.handshake.auth.roomId).emit(submitAction, { action: result });
    } catch (error) {
      console.error(error);
      io.to(socket.handshake.auth.roomId).emit(leaveRoom);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected`);
  });
});

export default io;
