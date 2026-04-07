const prisma = require('../prisma');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId) => {
      const uid = parseInt(userId);
      socket.join(`user_${uid}`);
      socket.join('public_room');
      
      // Join all group rooms the user is a member of
      try {
          const userRooms = await prisma.chatRoom.findMany({
              where: { members: { some: { userId: uid } } }
          });
          userRooms.forEach(room => {
              socket.join(`room_${room.id}`);
          });
          console.log(`User ${uid} joined ${userRooms.length} group rooms.`);
      } catch (err) {
          console.error("Error joining group rooms on socket:", err);
      }
      
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
              select: { 
                  id: true, 
                  username: true, 
                  role: true,
                  mahasiswa: { select: { nama: true } },
                  dosen: { select: { nama: true } }
              }
            },
            receiver: {
              select: { 
                  id: true, 
                  username: true, 
                  role: true,
                  mahasiswa: { select: { nama: true } },
                  dosen: { select: { nama: true } }
              }
            },
            parent: {
                 select: {
                     id: true,
                     content: true,
                     sender: { select: { username: true, mahasiswa: { select: { nama: true } }, dosen: { select: { nama: true } } } }
                 }
            },
            room: {
                 include: {
                     members: true
                 }
            }
          }
        });

        // Format sender username to full name for immediate display
        if (message.sender) {
            const fullName = message.sender.mahasiswa?.nama || message.sender.dosen?.nama || message.sender.username;
            message.sender.username = fullName;
        }

        if (isPublic) {
            io.to('public_room').emit('receive_message', message);
        } else if (roomId) {
            const rid = parseInt(roomId);
            // Broadcast to the group room (reaches all online members in that room)
            // Use io.to() to reach everyone including sender if they are in multiple tabs,
            // but useChat handles self-filtering.
            socket.to(`room_${rid}`).emit('receive_message', message);
            // Confirm to sender
            socket.emit('message_sent', message);
        } else {
            // Private DM
            io.to(`user_${receiverId}`).emit('receive_message', message);
            socket.emit('message_sent', message);
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('mark_read', async ({ conversationWithId, userId, roomId, isPublic }) => {
        try {
            const uid = parseInt(userId);
            if (isPublic) {
                // Mark all public messages as read by this user
                await prisma.$executeRaw`
                    UPDATE "Message" 
                    SET "readByIds" = array_append("readByIds", ${uid}) 
                    WHERE "isPublic" = true 
                    AND "senderId" != ${uid}
                    AND NOT (${uid} = ANY("readByIds"))
                `;
            } else if (roomId) {
                // Mark all messages in this room as read by this user
                const rid = parseInt(roomId);
                await prisma.$executeRaw`
                    UPDATE "Message" 
                    SET "readByIds" = array_append("readByIds", ${uid}) 
                    WHERE "roomId" = ${rid}
                    AND "senderId" != ${uid}
                    AND NOT (${uid} = ANY("readByIds"))
                `;
            } else if (conversationWithId) {
                // Original private chat logic
                await prisma.message.updateMany({
                    where: {
                        senderId: parseInt(conversationWithId),
                        receiverId: uid,
                        isRead: false
                    },
                    data: { isRead: true }
                });

                // Notify the sender that their messages were read
                io.to(`user_${conversationWithId}`).emit('messages_read', {
                    byUserId: uid
                });
            }
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
