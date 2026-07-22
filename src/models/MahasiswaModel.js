const BaseModel = require('./BaseModel');

/**
 * Mahasiswa Model wrapping Prisma mahasiswa table
 */
class MahasiswaModel extends BaseModel {
    constructor() {
        super('mahasiswa');
    }

    /**
     * Find Mahasiswa by NIM with related user data
     * @param {string} nim 
     * @returns {Promise<Object|null>} Mahasiswa object
     */
    async findByNim(nim) {
        return await this.findUnique({
            where: { nim },
            include: { user: true }
        });
    }

    /**
     * Get all mahasiswa with their related places of KP
     */
    async findAllWithTempatKP() {
        return await this.findMany({
            include: {
                tempatKP: true
            }
        });
    }
}

module.exports = new MahasiswaModel();
