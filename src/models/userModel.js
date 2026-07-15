const prisma = require('../prisma');
const bcrypt = require('bcrypt');

const findUserByIdentifier = async (identifier) => {
    if (!identifier) return null;
    
    return await prisma.user.findFirst({
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
};

const createUser = async (userData) => {
    const { username, password, email, role, name, ...otherDetails } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    return await prisma.user.create({
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
};

module.exports = {
    findUserByIdentifier,
    createUser
};

