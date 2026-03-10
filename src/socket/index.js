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
      const { senderId, receiverId, roomId, content, attachmentUrl, attachmentType, isPublic, replyToId } = data;

      try {
        let messageData = {
            senderId: parseInt(senderId),
            content,
            attachmentUrl,
            attachmentType,
            isPublic: !!isPublic,
            replyToId: replyToId ? parseInt(replyToId) : null
        };

        if (roomId) {
            messageData.roomId = parseInt(roomId);
        } else if (!isPublic && receiverId) {
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
            },
            room: {
                 include: {
                     members: true
                 }
            }
          }
        });

        if (isPublic) {
            io.to('public_room').emit('receive_message', message);
        } else if (roomId) {
            // Broadcast to all members in the group
            message.room.members.forEach((member) => {
               if (member.userId !== parseInt(senderId)) {
                   io.to(`user_${member.userId}`).emit('receive_message', message);
               }
            });
            // Send copy back to sender
            io.to(`user_${senderId}`).emit('message_sent', message);
        } else {
            io.to(`user_${receiverId}`).emit('receive_message', message);
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
                data: { isDeleted: true, content: 'Pesan ini telah dihapus', attachmentUrl: null },
                include: { room: { include: { members: true } } }
            });

            // We need to notify relevant parties.
            // If public, notify public room.
            if (deletedMessage.isPublic) {
                io.to('public_room').emit('message_deleted', { messageId });
            } else if (deletedMessage.roomId) {
                deletedMessage.room.members.forEach((member) => {
                    io.to(`user_${member.userId}`).emit('message_deleted', { messageId });
                });
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

    socket.on('edit_message', async ({ messageId, newContent }) => {
        try {
            const updatedMessage = await prisma.message.update({
                where: { id: parseInt(messageId) },
                data: { 
                    content: newContent,
                    isEdited: true
                },
                include: { room: { include: { members: true } } }
            });

            const payload = { 
                messageId, 
                newContent, 
                isEdited: true 
            };

            // Notify relevant parties
            if (updatedMessage.isPublic) {
                io.to('public_room').emit('message_edited', payload);
            } else if (updatedMessage.roomId) {
                updatedMessage.room.members.forEach((member) => {
                    io.to(`user_${member.userId}`).emit('message_edited', payload);
                });
            } else {
                io.to(`user_${updatedMessage.senderId}`).emit('message_edited', payload);
                if (updatedMessage.receiverId) {
                    io.to(`user_${updatedMessage.receiverId}`).emit('message_edited', payload);
                }
            }
        } catch (error) {
            console.error('Error editing message:', error);
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
