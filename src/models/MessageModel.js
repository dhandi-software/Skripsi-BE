const BaseModel = require('./BaseModel');

class MessageModel extends BaseModel {
    constructor() {
        super('message');
    }

    /**
     * Get unread messages count for a specific user
     */
    async getUnreadCount(userId) {
        return await this.count({
            where: {
                receiverId: userId,
                isRead: false
            }
        });
    }
}

module.exports = new MessageModel();
