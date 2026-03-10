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
                members: true
            }
        });

        res.status(201).json(chatRoom);
    } catch (error) {
        console.error('Error creating chat group:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message, stack: error.stack });
    }
};
