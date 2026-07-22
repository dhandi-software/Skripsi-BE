const BaseModel = require('./BaseModel');
const bcrypt = require('bcrypt');

/**
 * User Model wrapping Prisma user table
 */
class UserModel extends BaseModel {
    constructor() {
        super('user');
    }

    /**
     * Find a user by their identifier (username, NIDN, or email in related profile)
     * @param {string} identifier 
     * @returns {Promise<Object|null>} User object with related profiles
     */
    async findUserByIdentifier(identifier) {
        if (!identifier) return null;
        
        return await this.findFirst({
            where: {
                OR: [
                    { username: identifier },
                    { mahasiswa: { email: identifier } },
                    { dosen: { email: identifier } },
                    { staf: { email: identifier } },
                    { username: `D-${identifier}` } // Try with Dosen prefix for NIDN-based login
                ]
            },
            include: {
                mahasiswa: true,
                dosen: true,
                staf: true
            }
        });
    }

    /**
     * Create a new user with their associated profile based on role
     * @param {Object} userData 
     * @returns {Promise<Object>} Created user object
     */
    async createUser(userData) {
        const { username, password, email, role, name, ...otherDetails } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);

        return await this.create({
            data: {
                username,
                password: hashedPassword,
                role,
                // Create related profile based on role
                ...(role === 'MAHASISWA' && {
                    mahasiswa: {
                        create: {
                            nama: name,
                            nim: otherDetails.nim,
                            email: email,
                            userId: undefined // Prisma handles relation
                        }
                    }
                }),
                ...(role === 'DOSEN' && {
                    dosen: {
                        create: {
                            nama: name,
                            nip: otherDetails.nip,
                            jabatan: otherDetails.jabatan,
                            email: email,
                            userId: undefined
                        }
                    }
                }),
                ...(role === 'STAF' && {
                    staf: {
                        create: {
                            nama: name,
                            email: email,
                            userId: undefined
                        }
                    }
                }),
                // Kaprodi/Staf might not have extra profile yet in schema, just User
            }
        });
    }
}

// Export a singleton instance
module.exports = new UserModel();
