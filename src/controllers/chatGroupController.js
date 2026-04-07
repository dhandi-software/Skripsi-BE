const prisma = require('../prisma');

exports.createGroup = async (req, res) => {
    try {
        const { name, memberIds, adminId } = req.body;

        if (!name || !memberIds || !adminId) {
            return res.status(400).json({ message: 'Missing required fields: name, memberIds, adminId' });
        }

        // Validate admin is a Dosen
        const adminIdParsed = parseInt(adminId);
        if (isNaN(adminIdParsed)) {
            return res.status(400).json({ message: 'Invalid adminId format.' });
        }
        
        const adminUser = await prisma.user.findUnique({ where: { id: adminIdParsed } });
        if (!adminUser || adminUser.role.toUpperCase() !== 'DOSEN') {
            return res.status(403).json({ message: 'Only DOSEN can create groups.' });
        }

        // Add admin to memberIds automatically if not present
        const validatedMemberIds = memberIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        const allMemberIds = [...new Set([...validatedMemberIds, adminIdParsed])];

        // Create ChatRoom
        const chatRoom = await prisma.chatRoom.create({
            data: {
                name,
                adminId: adminIdParsed,
                isGroup: true,
                members: {
                    create: allMemberIds.map(id => ({ userId: id }))
                }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                role: true,
                                mahasiswa: { select: { nama: true } },
                                dosen: { select: { nama: true } }
                            }
                        }
                    }
                }
            }
        });

        const formattedRoom = {
            id: `group_${chatRoom.id}`,
            realId: chatRoom.id,
            username: chatRoom.name,
            role: "group",
            isGroup: true,
            adminId: chatRoom.adminId,
            members: chatRoom.members.map(m => ({
                id: m.user.id,
                username: m.user.mahasiswa?.nama || m.user.dosen?.nama || m.user.username,
                role: m.user.role
            }))
        };

        res.status(201).json(formattedRoom);
    } catch (error) {
        console.error('Error creating chat group:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message, stack: error.stack });
    }
};

exports.addMembers = async (req, res) => {
    try {
        const roomId = parseInt(req.params.id);
        const { memberIds, adminId } = req.body;

        if (isNaN(roomId) || !memberIds || !adminId) {
            return res.status(400).json({ message: 'Missing required fields: roomId, memberIds, adminId' });
        }

        const adminIdParsed = parseInt(adminId);
        
        // Cek room dan pastikan adminId valid
        const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
        if (!room || room.adminId !== adminIdParsed) {
            return res.status(403).json({ message: 'Only the group admin can add members.' });
        }

        const validatedMemberIds = memberIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        
        // Cari anggota yang sudah ada untuk mencegah duplikasi
        const existingMembers = await prisma.chatRoomMember.findMany({
            where: { roomId }
        });
        const existingMemberIds = existingMembers.map(m => m.userId);
        
        const newMemberIds = validatedMemberIds.filter(id => !existingMemberIds.includes(id));

        if (newMemberIds.length > 0) {
            await prisma.chatRoomMember.createMany({
                data: newMemberIds.map(id => ({ roomId, userId: id }))
            });
        }

        // Return the updated group with members
        const updatedRoom = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                role: true,
                                mahasiswa: { select: { nama: true } },
                                dosen: { select: { nama: true } }
                            }
                        }
                    }
                }
            }
        });

        const formattedRoom = {
            id: `group_${updatedRoom.id}`,
            realId: updatedRoom.id,
            username: updatedRoom.name,
            role: "group",
            isGroup: true,
            adminId: updatedRoom.adminId,
            members: updatedRoom.members.map(m => ({
                id: m.user.id,
                username: m.user.mahasiswa?.nama || m.user.dosen?.nama || m.user.username,
                role: m.user.role
            }))
        };

        res.status(200).json(formattedRoom);
    } catch (error) {
        console.error('Error adding chat group members:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const roomId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);
        const adminId = parseInt(req.body.adminId || req.query.adminId);

        if (isNaN(roomId) || isNaN(userId) || isNaN(adminId)) {
            return res.status(400).json({ message: 'Missing required fields: roomId, userId, adminId' });
        }

        const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
        if (!room || room.adminId !== adminId) {
            return res.status(403).json({ message: 'Only the group admin can remove members.' });
        }

        if (adminId === userId) {
            return res.status(400).json({ message: 'Admin cannot remove themselves from the group.' });
        }

        await prisma.chatRoomMember.deleteMany({
            where: {
                roomId: roomId,
                userId: userId
            }
        });

        // Return updated room state
        const updatedRoom = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                role: true,
                                mahasiswa: { select: { nama: true } },
                                dosen: { select: { nama: true } }
                            }
                        }
                    }
                }
            }
        });

        const formattedRoom = {
            id: `group_${updatedRoom.id}`,
            realId: updatedRoom.id,
            username: updatedRoom.name,
            role: "group",
            isGroup: true,
            adminId: updatedRoom.adminId,
            members: updatedRoom.members.map(m => ({
                id: m.user.id,
                username: m.user.mahasiswa?.nama || m.user.dosen?.nama || m.user.username,
                role: m.user.role
            }))
        };

        // Notify the removed member via Socket.io
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('group_member_removed', { groupId: roomId });
        }

        res.status(200).json(formattedRoom);
    } catch (error) {
        console.error('Error removing chat group member:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const roomId = parseInt(req.params.id);
        const adminId = parseInt(req.body.adminId || req.query.adminId);

        if (isNaN(roomId) || isNaN(adminId)) {
            return res.status(400).json({ message: 'Missing required fields: roomId, adminId' });
        }

        const room = await prisma.chatRoom.findUnique({ 
            where: { id: roomId },
            include: { members: true }
        });
        
        if (!room || room.adminId !== adminId) {
            return res.status(403).json({ message: 'Only the group admin can delete the group.' });
        }

        // Notify all members via Socket.io before deleting
        const io = req.app.get('io');
        if (io) {
            room.members.forEach(member => {
                if (member.userId !== adminId) { // Admin already knows
                    io.to(`user_${member.userId}`).emit('group_deleted', { groupId: roomId });
                }
            });
        }

        // Delete all messages first, then delete the group itself
        // Note: ChatRoomMember has onDelete: Cascade, so it deletes automatically,
        // but Message table does not have Cascade on roomId, so it must be explicit.
        await prisma.$transaction([
            prisma.message.deleteMany({ where: { roomId: roomId } }),
            prisma.chatRoom.delete({ where: { id: roomId } })
        ]);

        res.status(200).json({ message: 'Group deleted successfully', roomId });
    } catch (error) {
        console.error('Error deleting chat group:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
