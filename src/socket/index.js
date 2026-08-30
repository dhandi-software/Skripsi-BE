const prisma = require('../prisma');
const { notifyNewChatMessage } = require('../utils/emailService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId) => {
      const uid = parseInt(userId);
      socket.join(`user_${uid}`);
      
      try {
          const user = await prisma.user.findUnique({ where: { id: uid } });
          if (user && !user.isBannedFromPublic) {
              socket.join('public_room');
              console.log(`User ${userId} joined public_room`);
          } else {
              console.log(`User ${userId} is banned from public_room`);
          }

          // Join all group rooms the user is a member of
          const userRooms = await prisma.chatRoom.findMany({
              where: { members: { some: { userId: uid } } }
          });
          userRooms.forEach(room => {
              socket.join(`room_${room.id}`);
          });
          console.log(`User ${uid} joined ${userRooms.length} group rooms.`);
      } catch (err) {
          console.error("Error joining rooms on socket:", err);
      }
      
      console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on('send_message', async (data) => {
      const { senderId, receiverId, roomId, content, attachmentUrl, attachmentType, fileName, isPublic, replyToId } = data;

      try {
        const actualSenderId = socket.userId ? parseInt(socket.userId) : parseInt(senderId);
        
        if (!actualSenderId || isNaN(actualSenderId)) {
          socket.emit('error', { message: 'Sender identity not valid' });
          return;
        }

        // Check if user is banned from public chat
        if (isPublic) {
            const user = await prisma.user.findUnique({ where: { id: actualSenderId } });
            if (user?.isBannedFromPublic) {
                socket.emit('error', { message: 'Anda telah dikeluarkan dari Ruang Publik oleh Admin.' });
                return;
            }
        }
        let messageData = {
            senderId: actualSenderId,
            content,
            attachmentUrl,
            attachmentType,
            fileName,
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
                  dosen: { select: { nama: true } },
                  staf: { select: { nama: true } }
              }
            },
            receiver: {
              select: { 
                  id: true, 
                  username: true, 
                  role: true,
                  mahasiswa: { select: { nama: true } },
                  dosen: { select: { nama: true } },
                  staf: { select: { nama: true } }
              }
            },
            parent: {
                 select: {
                     id: true,
                     content: true,
                     sender: { select: { username: true, role: true, mahasiswa: { select: { nama: true } }, dosen: { select: { nama: true } }, staf: { select: { nama: true } } } }
                 }
            },
            room: {
                 include: {
                     members: true
                 }
            }
          }
        });

        const getDisplayName = (u) => {
            if (!u) return "Seseorang";
            const role = (u.role || '').toLowerCase();
            if (role === 'admin') return u.staf?.nama || "Administrator";
            return u.mahasiswa?.nama || u.dosen?.nama || u.staf?.nama || u.username || "Seseorang";
        };

        // Format sender username to full name for immediate display
        if (message.sender) {
            message.sender.username = getDisplayName(message.sender);
        }

        // Format parent sender username if it's a reply
        if (message.parent && message.parent.sender) {
            message.parent.sender.username = getDisplayName(message.parent.sender);
        }

        if (isPublic) {
            socket.to('public_room').emit('receive_message', message);
            socket.emit('message_sent', message);
        } else if (roomId) {
            const rid = parseInt(roomId);
            socket.to(`room_${rid}`).emit('receive_message', message);
            socket.emit('message_sent', message);
        } else {
            // Private DM
            io.to(`user_${receiverId}`).emit('receive_message', message);
            socket.emit('message_sent', message);

            // Send Email Notification to Recipient (Filtered by Role Rules)
            if (receiverId) {
                Promise.all([
                    prisma.user.findUnique({
                        where: { id: actualSenderId },
                        include: { mahasiswa: true, dosen: true, staf: true }
                    }),
                    prisma.user.findUnique({
                        where: { id: parseInt(receiverId) },
                        include: { mahasiswa: true, dosen: true, staf: true }
                    })
                ]).then(([sendUser, recUser]) => {
                    if (!sendUser || !recUser) return;

                    const senderRole = (sendUser.role || '').toUpperCase();
                    const receiverRole = (recUser.role || '').toUpperCase();

                    // RULE 1: Sesama Mahasiswa -> Mahasiswa (JANGAN KIRIM NOTIFIKASI EMAIL)
                    if (senderRole === 'MAHASISWA' && receiverRole === 'MAHASISWA') {
                        return; // Dibatasi agar sesama mahasiswa tidak saling spaming email
                    }

                    // RULE 2: Dosen / Staf -> Mahasiswa (KIRIM EMAIL)
                    // RULE 3: Anyone -> Dosen (KIRIM EMAIL TO DOSEN)
                    const targetEmail = recUser?.mahasiswa?.email || recUser?.dosen?.email || recUser?.staf?.email;
                    const targetName = getDisplayName(recUser);
                    const senderName = getDisplayName(sendUser);
                    const isAttachment = !!attachmentUrl || (content && (content.includes("Mengirimkan sebuah lampiran file") || content.includes("/uploads/")));
                    const chatText = content || (attachmentUrl ? "Mengirimkan sebuah lampiran file" : "Pesan baru");

                    if (targetEmail) {
                        notifyNewChatMessage(targetEmail, targetName, senderName, chatText, {
                            isAttachment,
                            category: isAttachment ? "Lampiran Dokumen" : "Pesan Chat"
                        }).catch(e => console.error("Chat email notify error:", e));
                    }
                }).catch(e => console.error("User lookup error for chat email:", e));
            }
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
