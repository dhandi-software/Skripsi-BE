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
        } else {
            whereClause = {
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
                sender: { select: { username: true, role: true } },
                receiver: { select: { username: true, role: true } },
                parent: {
                    select: {
                        id: true,
                        content: true,
                        sender: { select: { username: true } }
                    }
                }
            }
        });

        res.json(messages);
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
                email: true
            }
        });

        // Fetch last message for each user
        // Optimization: Fetch all messages involving current user
        const messages = await prisma.message.findMany({
             where: {
                OR: [
                    { senderId: userId },
                    { receiverId: userId },
                    { isPublic: true } // Include public messages to check for Public Room activity
                ]
             },
             orderBy: { createdAt: 'desc' },
             // We can't strictly limit here easily if we want *all* last messages for *all* contacts
        });

        const usersWithLastMessage = users.map(user => {
            // Find the most recent message between currentUser and this user
            const lastMsg = messages.find(m => 
                (!m.isPublic && (
                    (m.senderId === userId && m.receiverId === user.id) || 
                    (m.senderId === user.id && m.receiverId === userId)
                ))
            );
            return { ...user, lastMessage: lastMsg };
        });
        const lastPublicMessage = messages.find(m => m.isPublic);
        
        res.json({
            users: usersWithLastMessage,
            lastPublicMessage
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
