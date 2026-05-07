const prisma = require('../prisma');

exports.uploadAttachment = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, type: req.file.mimetype });
};

exports.getChatHistory = async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        
        let whereClause;
        if (otherUserId === 'public') {
            whereClause = { 
                isPublic: true,
                NOT: { deletedBy: { some: { id: parseInt(userId) } } }
            };
        } else if (otherUserId.startsWith('group_')) {
            const roomId = parseInt(otherUserId.split('_')[1]);
            whereClause = {
                roomId: roomId,
                NOT: { deletedBy: { some: { id: parseInt(userId) } } }
            };
        } else {
            whereClause = {
                roomId: null,
                OR: [
                    { senderId: parseInt(userId), receiverId: parseInt(otherUserId) },
                    { senderId: parseInt(otherUserId), receiverId: parseInt(userId) }
                ],
                NOT: { deletedBy: { some: { id: parseInt(userId) } } }
            };
        }

        const messages = await prisma.message.findMany({
            where: whereClause,
            orderBy: {
                createdAt: 'asc'
            },
            include: {
                sender: { select: { username: true, role: true, photo: true, mahasiswa: { select: { nama: true } }, dosen: { select: { nama: true } }, staf: { select: { nama: true } } } },
                receiver: { select: { username: true, role: true, photo: true, mahasiswa: { select: { nama: true } }, dosen: { select: { nama: true } }, staf: { select: { nama: true } } } },
                parent: {
                    select: {
                        id: true,
                        content: true,
                        sender: { select: { username: true, photo: true, mahasiswa: { select: { nama: true } }, dosen: { select: { nama: true } }, staf: { select: { nama: true } } } }
                    }
                }
            }
        });

        const formattedMessages = messages.map(msg => {
            const formatName = (userObj) => userObj?.mahasiswa?.nama || userObj?.dosen?.nama || userObj?.staf?.nama || userObj?.username;
            return {
                ...msg,
                sender: msg.sender ? { ...msg.sender, username: formatName(msg.sender) } : null,
                receiver: msg.receiver ? { ...msg.receiver, username: formatName(msg.receiver) } : null,
                parent: msg.parent ? { ...msg.parent, sender: { ...msg.parent.sender, username: formatName(msg.parent.sender) } } : null
            };
        });

        res.json(formattedMessages);
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getContacts = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Find all users except current user
        const users = await prisma.user.findMany({
            where: {
                id: { not: userId }
            },
            select: {
                id: true,
                username: true,
                role: true,
                email: true,
                photo: true,
                mahasiswa: { select: { nama: true } },
                dosen:     { select: { nama: true } },
                staf:      { select: { nama: true } }
            }
        });

        const formattedUsers = users.map(u => ({
            id: u.id,
            username: u.mahasiswa?.nama || u.dosen?.nama || u.staf?.nama || u.username,
            role: u.role,
            email: u.email,
            photo: u.photo
        }));

        // Fetch user's group rooms
        const rooms = await prisma.chatRoom.findMany({
            where: { members: { some: { userId: userId } } },
            include: { 
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                role: true,
                                photo: true,
                                mahasiswa: { select: { nama: true } },
                                dosen: { select: { nama: true } },
                                staf: { select: { nama: true } }
                            }
                        }
                    }
                }
            }
        });

        const formattedRooms = rooms.map(r => ({
            id: `group_${r.id}`, // Unique string ID for frontend
            realId: r.id,
            username: r.name,
            role: "group",
            isGroup: true,
            adminId: r.adminId,
            members: r.members.map(m => ({
                id: m.user.id,
                username: m.user.mahasiswa?.nama || m.user.dosen?.nama || m.user.staf?.nama || m.user.username,
                role: m.user.role,
                photo: m.user.photo
            }))
        }));

        const allContacts = [...formattedUsers, ...formattedRooms];

        const messages = await prisma.message.findMany({
             where: {
                OR: [
                    { senderId: userId },
                    { receiverId: userId },
                    { isPublic: true },
                    { roomId: { in: rooms.map(r => r.id) } }
                ]
             },
             orderBy: { createdAt: 'desc' },
        });

        const contactsWithLastMessage = allContacts.map(contact => {
            let lastMsg;
            let unreadCount = 0;
            if (contact.isGroup) {
                const groupMsgs = messages.filter(m => m.roomId === contact.realId);
                lastMsg = groupMsgs[0]; // Messages are ordered desc
                unreadCount = groupMsgs.filter(m => m.senderId !== userId && (!m.readByIds || !m.readByIds.includes(userId))).length;
            } else {
                const dmMsgs = messages.filter(m => 
                    !m.isPublic && !m.roomId && (
                        (m.senderId === userId && m.receiverId === contact.id) || 
                        (m.senderId === contact.id && m.receiverId === userId)
                    )
                );
                lastMsg = dmMsgs[0];
                unreadCount = dmMsgs.filter(m => m.senderId === contact.id && m.receiverId === userId && !m.isRead).length;
            }
            return { ...contact, lastMessage: lastMsg, unreadCount };
        });
        
        const publicMsgs = messages.filter(m => m.isPublic);
        const lastPublicMessage = publicMsgs[0];
        const publicUnreadCount = publicMsgs.filter(m => m.senderId !== userId && (!m.readByIds || !m.readByIds.includes(userId))).length;
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBannedFromPublic: true }
        });
        
        res.json({
            users: contactsWithLastMessage,
            lastPublicMessage,
            publicUnreadCount,
            isBannedFromPublic: user?.isBannedFromPublic || false
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        
        // Count unread direct messages
        const directCount = await prisma.message.count({
            where: {
                receiverId: userId,
                isRead: false,
                roomId: null,
                isPublic: false
            }
        });

        // Count unread group messages WHERE user is member AND user has NOT read it
        const groupCount = await prisma.message.count({
            where: {
                roomId: { not: null },
                room: { members: { some: { userId: userId } } },
                senderId: { not: userId },
                NOT: { readByIds: { has: userId } }
            }
        });

        // Count unread public messages if not initiated by this user
        const publicCount = await prisma.message.count({
            where: {
                isPublic: true,
                senderId: { not: userId },
                NOT: { readByIds: { has: userId } }
            }
        });

        res.json({ count: directCount + groupCount + publicCount });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPublicMembers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                role: true,
                photo: true,
                isBannedFromPublic: true,
                mahasiswa: { select: { nama: true } },
                dosen: { select: { nama: true } },
                staf: { select: { nama: true } }
            },
            orderBy: { username: 'asc' }
        });

        const formattedMembers = users.map(u => ({
            id: u.id,
            username: u.mahasiswa?.nama || u.dosen?.nama || u.staf?.nama || u.username,
            role: u.role,
            photo: u.photo,
            isBanned: u.isBannedFromPublic
        }));

        res.json(formattedMembers);
    } catch (error) {
        console.error('Error fetching public members:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.kickFromPublic = async (req, res) => {
    try {
        const { userId } = req.body;
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { isBannedFromPublic: true }
        });

        // Notify user via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('public_banned', { userId });
        }

        res.json({ message: 'User berhasil dikeluarkan dari Ruang Publik' });
    } catch (error) {
        console.error('Error kicking from public:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.unbanFromPublic = async (req, res) => {
    try {
        const { userId } = req.body;
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { isBannedFromPublic: false }
        });

        // Notify user via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('public_unbanned', { userId });
        }

        res.json({ message: 'User berhasil dikembalikan ke Ruang Publik' });
    } catch (error) {
        console.error('Error unbanning from public:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
