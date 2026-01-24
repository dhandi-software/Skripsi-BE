const prisma = require('../prisma');
const bcrypt = require('bcrypt');

const findUserByIdentifier = async (identifier) => {
    return await prisma.user.findFirst({
        where: {
            OR: [
                { username: identifier },
                { email: identifier }
            ]
        },
        include: {
            mahasiswa: true,
            dosen: true
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
            email,
            role,
            // Create related profile based on role
            ...(role === 'MAHASISWA' && {
                mahasiswa: {
                    create: {
                        nama: name,
                        nim: otherDetails.nim,
                        jurusan: otherDetails.jurusan,
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

