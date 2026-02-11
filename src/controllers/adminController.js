const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const createMahasiswa = async (req, res) => {
    try {
        const { email, password, nama, nim, jurusan, tahunMasuk } = req.body;

        // Basic Validation
        if (!email || !password || !nama || !nim || !jurusan || !tahunMasuk) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const existingNim = await prisma.mahasiswa.findUnique({ where: { nim } });
        if (existingNim) {
            return res.status(400).json({ message: "NIM already registered" });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction to create User and Mahasiswa profile
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    username: nim, // Use NIM as username for Mahasiswa by default logic, or email. Let's use NIM or unique generated.
                    // User Request didn't specify username logic, but usually it's unique. 
                    // Let's use email prefix or NIM. existing auth might rely on username.
                    // let's use email for now or requested field. 
                    // Actually, let's use NIM as username to ensure uniqueness easily.
                    email,
                    password: hashedPassword,
                    role: 'mahasiswa', // lowercase as per used convention
                }
            });

            const mahasiswa = await prisma.mahasiswa.create({
                data: {
                    userId: user.id,
                    nim,
                    nama,
                    jurusan,
                    tahunMasuk
                }
            });

            return { user, mahasiswa };
        });

        res.status(201).json({ message: "Mahasiswa account created successfully", data: result });

    } catch (error) {
        console.error("Error creating mahasiswa:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const createDosen = async (req, res) => {
    try {
        const { email, password, nama, nidn, jabatan } = req.body;

        // Basic Validation
        if (!email || !password || !nama || !nidn || !jabatan) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const existingNidn = await prisma.dosen.findUnique({ where: { nidn } });
        if (existingNidn) {
            return res.status(400).json({ message: "NIDN already registered" });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    username: nidn, // Use NIDN as username
                    email,
                    password: hashedPassword,
                    role: 'dosen', // lowercase
                }
            });

            const dosen = await prisma.dosen.create({
                data: {
                    userId: user.id,
                    nidn,
                    nama,
                    jabatan
                }
            });

            return { user, dosen };
        });

        res.status(201).json({ message: "Dosen account created successfully", data: result });

    } catch (error) {
        console.error("Error creating dosen:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getUserCountByRole = async (req, res) => {
    try {
        const { role } = req.query;
        if (!role) return res.status(400).json({ message: "Role is required" });

        const count = await prisma.user.count({
            where: { role: role.toLowerCase() }
        });

        res.json({
            object: "user",
            type: role,
            count
        });
    } catch (error) {
        console.error("Error counting user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getUsersByRole = async (req, res) => {
    try {
        const { role } = req.query;
        if (!role) return res.status(400).json({ message: "Role is required" });

        let users;
        const lowerRole = role.toLowerCase();

        if (lowerRole === 'mahasiswa') {
            users = await prisma.mahasiswa.findMany({
                include: { user: { select: { email: true, id: true } } }
            });
        } else if (lowerRole === 'dosen') {
            users = await prisma.dosen.findMany({
                include: { user: { select: { email: true, id: true } } }
            });
        } else {
             users = await prisma.user.findMany({
                where: { role: lowerRole },
                select: { id: true, email: true, username: true, role: true }
             });
        }

        res.json({ data: users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getMonitoringData = async (req, res) => {
    try {
        const dosens = await prisma.dosen.findMany({
            select: {
                id: true,
                nama: true,
                nidn: true,
                jabatan: true,
                user: {
                    select: { email: true }
                },
                bimbingan: {
                    select: {
                        id: true,
                        judul: true,
                        status: true,
                        mahasiswa: {
                            select: {
                                id: true,
                                nama: true,
                                nim: true
                            }
                        }
                    }
                }
            }
        });

        const data = dosens.map(dosen => ({
            id: dosen.id,
            nama: dosen.nama,
            nidn: dosen.nidn,
            email: dosen.user?.email, // Optional chaining just in case
            jabatan: dosen.jabatan,
            totalBimbingan: dosen.bimbingan.length,
            mahasiswaBimbingan: dosen.bimbingan.map(b => ({
                id: b.mahasiswa.id,
                nama: b.mahasiswa.nama,
                nim: b.mahasiswa.nim,
                judulSkripsi: b.judul || "Has not proposed yet",
                status: b.status
            }))
        }));

        res.json({ data });
    } catch (error) {
         console.error("Error fetching monitoring data:", error);
         res.status(500).json({ message: "Internal Server Error" });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, role, ...profileData } = req.body;

        // Check user existence
        const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
        if (!user) return res.status(404).json({ message: "User not found" });

        const updateData = {};
        if (email) updateData.email = email;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        // Transaction for atomic update
        await prisma.$transaction(async (prisma) => {
             // Update User basic info
             if (Object.keys(updateData).length > 0) {
                 await prisma.user.update({
                     where: { id: parseInt(id) },
                     data: updateData
                 });
             }

             // Update Profile based on role
             if (user.role === 'mahasiswa') {
                 await prisma.mahasiswa.update({
                     where: { userId: parseInt(id) },
                     data: {
                         nama: profileData.name || profileData.nama,
                         nim: profileData.nim,
                         jurusan: profileData.jurusan,
                         tahunMasuk: profileData.tahunMasuk
                     }
                 });
             } else if (user.role === 'dosen') {
                 await prisma.dosen.update({
                     where: { userId: parseInt(id) },
                     data: {
                         nama: profileData.name || profileData.nama,
                         nidn: profileData.nidn,
                         jabatan: profileData.jabatan
                     }
                 });
             }
        });

        res.json({ message: "User updated successfully" });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.$transaction(async (prisma) => {
            // Check user role to delete profile first (if cascading isn't set up, but let's be safe)
            const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
            
            if (!user) {
                // Should return here, but transaction wrapper handles error logic differently usually
                // throwing error effectively cancels transaction
                throw new Error("User not found"); 
            }

            if (user.role === 'mahasiswa') {
                await prisma.mahasiswa.delete({ where: { userId: parseInt(id) } });
            } else if (user.role === 'dosen') {
                await prisma.dosen.delete({ where: { userId: parseInt(id) } });
            }

            await prisma.user.delete({ where: { id: parseInt(id) } });
        });

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error.message);
        if (error.message === "User not found") return res.status(404).json({ message: "User not found" });
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: {
                mahasiswa: true,
                dosen: true
            }
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Flatten the structure for easier frontend consumption
        let userData = {
            id: user.id,
            email: user.email,
            role: user.role,
            ... (user.mahasiswa ? user.mahasiswa : {}),
            ... (user.dosen ? user.dosen : {})
        };
        // Remove redundant IDs if necessary or keep them
        
        res.json({ data: userData });

    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    createMahasiswa,
    createDosen,
    getUserCountByRole,
    getUsersByRole,
    getMonitoringData,
    updateUser,
    deleteUser,
    getUserById
};
