const prisma = require('../prisma');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      socket.join('public_room'); // Join public room automatically
      console.log(`User ${userId} joined room user_${userId} and public_room`);
    });

    socket.on('send_message', async (data) => {
      const { senderId, receiverId, content, attachmentUrl, attachmentType, isPublic, replyToId } = data;

      try {
        let messageData = {
            senderId: parseInt(senderId),
            content,
            attachmentUrl,
            attachmentType,
            isPublic: !!isPublic,
            replyToId: replyToId ? parseInt(replyToId) : null
        };

        if (!isPublic) {
            messageData.receiverId = parseInt(receiverId);
        }

        const message = await prisma.message.create({
          data: messageData,
          include: {
            sender: {
              select: { username: true, role: true }
            },
            receiver: {
              select: { username: true, role: true }
            },
            parent: {
                 select: {
                     id: true,
                     content: true,
                     sender: { select: { username: true } }
                 }
            }
          }
        });

        if (isPublic) {
            // Broadcast to everyone in public room (including sender)
            io.to('public_room').emit('receive_message', message);
        } else {
            // Emit to receiver
            io.to(`user_${receiverId}`).emit('receive_message', message);
            // Emit back to sender
            io.to(`user_${senderId}`).emit('message_sent', message);
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('mark_read', async ({ conversationWithId, userId }) => {
        try {
            // Update all messages sent by conversationWithId to userId as read
            await prisma.message.updateMany({
                where: {
                    senderId: parseInt(conversationWithId),
                    receiverId: parseInt(userId),
                    isRead: false
                },
                data: { isRead: true }
            });

            // Notify the sender (conversationWithId) that their messages were read
            io.to(`user_${conversationWithId}`).emit('messages_read', {
                byUserId: userId
            });
        } catch (error) {
            console.error('Error marking read:', error);
        }
    });

    socket.on('delete_message', async ({ messageId }) => {
        try {
            const deletedMessage = await prisma.message.update({
                where: { id: parseInt(messageId) },
                data: { isDeleted: true, content: 'Pesan ini telah dihapus', attachmentUrl: null }
            });

            // We need to notify relevant parties.
            // If public, notify public room.
            if (deletedMessage.isPublic) {
                io.to('public_room').emit('message_deleted', { messageId });
            } else {
                // If private, notify sender and receiver
                io.to(`user_${deletedMessage.senderId}`).emit('message_deleted', { messageId });
                if (deletedMessage.receiverId) {
                    io.to(`user_${deletedMessage.receiverId}`).emit('message_deleted', { messageId });
                }
            }
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    });

    socket.on('delete_message_for_me', async ({ messageId, userId }) => {
        try {
            await prisma.message.update({
                where: { id: parseInt(messageId) },
                data: {
                    deletedBy: {
                        connect: { id: parseInt(userId) }
                    }
                }
            });
            // Notify the user to remove it from their view
            socket.emit('message_deleted_for_me', { messageId });
        } catch (error) {
           console.error('Error deleting message for me:', error);
        }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
