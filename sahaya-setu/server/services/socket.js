const { Server } = require('socket.io');
const Notification = require('../models/Notification');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
  });

  io.on('connection', (socket) => {
    // Client joins rooms for role, department, user
    socket.on('join', ({ userId, role, department }) => {
      if (userId) socket.join(`user_${userId}`);
      if (role) socket.join(`role_${role}`);
      if (department && department !== '*') socket.join(`dept_${department}`);
      socket.join('public_channel');
    });

    socket.on('join_disaster_channel', () => {
      socket.join('disaster_channel');
    });

    socket.on('leave_disaster_channel', () => {
      socket.leave('disaster_channel');
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
}

function getIO() {
  return io;
}

function notifyAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

function notifyUser(userId, event, data) {
  if (io && userId) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

function notifyDepartment(department, event, data) {
  if (io) {
    if (department && department !== '*') {
      io.to(`dept_${department}`).emit(event, data);
    }
    // Also send to super admins
    io.to('role_super_admin').emit(event, data);
  }
}

function notifyRole(role, event, data) {
  if (io && role) {
    io.to(`role_${role}`).emit(event, data);
  }
}

async function createAndPushNotification({
  recipient_id = null,
  recipient_role = 'all',
  department = null,
  title,
  message,
  complaint_id = null,
  ticket_code = '',
  type = 'general',
}) {
  try {
    const notif = new Notification({
      recipient_id,
      recipient_role,
      department,
      title,
      message,
      complaint_id,
      ticket_code,
      type,
    });
    await notif.save();

    // Broadcast over WebSocket
    if (recipient_id) {
      notifyUser(recipient_id, 'notification', notif);
    } else if (department) {
      notifyDepartment(department, 'notification', notif);
    } else if (recipient_role && recipient_role !== 'all') {
      notifyRole(recipient_role, 'notification', notif);
    } else {
      notifyAll('notification', notif);
    }

    return notif;
  } catch (err) {
    console.error('Failed to create and push notification:', err);
    return null;
  }
}

module.exports = {
  initSocket,
  getIO,
  notifyAll,
  notifyUser,
  notifyDepartment,
  notifyRole,
  createAndPushNotification,
};
