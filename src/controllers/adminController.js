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

const createMahasiswaMassal = async (req, res) => {
    try {
        const { users } = req.body;

        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ message: "Users array is required and must not be empty" });
        }

        // Validate basic fields to catch errors early
        for (const user of users) {
             if (!user.email || !user.password || !user.nama || !user.nim || !user.jurusan || !user.tahunMasuk) {
                 return res.status(400).json({ message: "All fields are required for each user in the array." });
             }
        }

        const results = await prisma.$transaction(async (prisma) => {
            const createdUsers = [];
            for (const item of users) {
                // Check if email or NIM already exists within the transaction to avoid duplicates
                const existingUser = await prisma.user.findUnique({ where: { email: item.email } });
                const existingNim = await prisma.mahasiswa.findUnique({ where: { nim: item.nim } });
                
                if (existingUser || existingNim) {
                     // We can either skip or throw an error to abort transaction. 
                     // Usually for mass upload, it's better to fail the whole batch or return specific errors.
                     // Let's fail the transaction if there is a duplicate to ensure data integrity.
                     throw new Error(`Duplicate entry found for NIM: ${item.nim} or Email: ${item.email}`);
                }

                const hashedPassword = await bcrypt.hash(item.password, 10);

                const user = await prisma.user.create({
                    data: {
                        username: item.nim,
                        email: item.email,
                        password: hashedPassword,
                        role: 'mahasiswa',
                    }
                });

                const mahasiswa = await prisma.mahasiswa.create({
                    data: {
                        userId: user.id,
                        nim: item.nim,
                        nama: item.nama,
                        jurusan: item.jurusan,
                        tahunMasuk: item.tahunMasuk
                    }
                });

                createdUsers.push({ user, mahasiswa });
            }
            return createdUsers;
        });

        res.status(201).json({ message: "Mahasiswa accounts created successfully", count: results.length });

    } catch (error) {
        console.error("Error creating mass mahasiswa:", error);
        res.status(500).json({ message: error.message || "Internal Server Error" });
    }
};

const createDosenMassal = async (req, res) => {
    try {
        const { users } = req.body;
        if (!users || !Array.isArray(users)) {
            return res.status(400).json({ message: "Invalid users data provided" });
        }

        const results = await prisma.$transaction(async (prisma) => {
            const createdUsers = [];
            for (const item of users) {
                // Check if email or NIDN already exists
                const existingUser = await prisma.user.findUnique({ where: { email: item.email } });
                const existingNidn = await prisma.dosen.findUnique({ where: { nidn: item.nim } }); // hook passes NIDN as 'nim' for compatibility or shared UI structure
                
                if (existingUser || existingNidn) {
                    throw new Error(`Duplicate entry found for NIDN: ${item.nim} or Email: ${item.email}`);
                }

                const hashedPassword = await bcrypt.hash(item.password, 10);

                const user = await prisma.user.create({
                    data: {
                        username: item.nim,
                        email: item.email,
                        password: hashedPassword,
                        role: 'dosen',
                    }
                });

                const dosen = await prisma.dosen.create({
                    data: {
                        userId: user.id,
                        nidn: item.nim,
                        nama: item.nama,
                        jabatan: item.jabatan || "Dosen"
                    }
                });

                createdUsers.push({ user, dosen });
            }
            return createdUsers;
        });

        res.status(201).json({ message: "Dosen accounts created successfully", count: results.length });

    } catch (error) {
        console.error("Error creating mass dosen:", error);
        res.status(500).json({ message: error.message || "Internal Server Error" });
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
        // Only hash and update password if it's different from the current one (i.e. user changed it)
        // If it's the same (pre-filled hash), ignore it.
        if (password && password !== user.password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

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

const deleteUsersBatch = async (req, res) => {
    try {
        const { ids } = req.body; // Expecting array of integers
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid user IDs provided" });
        }

        const deletedIds = [];
        const blockedUsers = [];

        for (const id of ids) {
            try {
                const user = await prisma.user.findUnique({ 
                    where: { id: parseInt(id) },
                    include: { mahasiswa: true, dosen: true }
                });
                
                if (!user) continue;

                // Check for ANY blocking academic data
                let hasActiveData = false;
                let reason = "";

                if (user.role === 'mahasiswa' && user.mahasiswa) {
                    const mid = user.mahasiswa.id;
                    const bCount = await prisma.bimbingan.count({ where: { mahasiswaId: mid } });
                    const sCount = await prisma.sidang.count({ where: { mahasiswaId: mid } });
                    const pCount = await prisma.penilaian.count({ where: { mahasiswaId: mid } });
                    const jCount = await prisma.pengajuanJudul.count({ where: { mahasiswaId: mid } });
                    
                    if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
                } else if (user.role === 'dosen' && user.dosen) {
                    const did = user.dosen.id;
                    const bCount = await prisma.bimbingan.count({ where: { dosenId: did } });
                    const sCount = await prisma.sidang.count({ where: { dosenId: did } });
                    const pCount = await prisma.penilaian.count({ where: { dosenId: did } });
                    const jCount = await prisma.pengajuanJudul.count({ where: { dosenId: did } });
                    
                    if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
                }

                if (hasActiveData) {
                    blockedUsers.push(user.mahasiswa?.nama || user.dosen?.nama || user.username);
                    continue; 
                }

                // Proceed with deletion in a per-user transaction
                await prisma.$transaction(async (tx) => {
                    if (user.role === 'mahasiswa') {
                        await tx.mahasiswa.deleteMany({ where: { userId: parseInt(id) } });
                    } else if (user.role === 'dosen') {
                        await tx.dosen.deleteMany({ where: { userId: parseInt(id) } });
                    }
                    await tx.user.delete({ where: { id: parseInt(id) } });
                });

                deletedIds.push(id);
            } catch (err) {
                console.error(`Error deleting user ID ${id}:`, err.message);
                blockedUsers.push(`ID ${id} (system error)`);
            }
        }

        if (deletedIds.length === 0 && blockedUsers.length > 0) {
            const isSingle = blockedUsers.length === 1;
            const message = isSingle 
                ? `Gagal menghapus. User ${blockedUsers[0]} tidak dapat dihapus karena memiliki data aktif.`
                : `Gagal menghapus. Semua user yang dipilih (${blockedUsers.join(', ')}) memiliki data aktif.`;
            return res.status(400).json({ message });
        }

        let message = `${deletedIds.length} user berhasil dihapus.`;
        if (blockedUsers.length > 0) {
            const count = blockedUsers.length;
            // Always show names since the tooltip/toast now handles it
            message += ` ${count} user (${blockedUsers.join(', ')}) dilewati karena memiliki bimbingan/tugas akhir.`;
        }

        res.json({ message });
    } catch (error) {
        console.error("Critical error in bulk delete:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await prisma.user.findUnique({ 
            where: { id: parseInt(id) },
            include: { mahasiswa: true, dosen: true }
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check for ANY active academic data
        let hasActiveData = false;
        if (user.role === 'mahasiswa' && user.mahasiswa) {
            const mid = user.mahasiswa.id;
            const bCount = await prisma.bimbingan.count({ where: { mahasiswaId: mid } });
            const sCount = await prisma.sidang.count({ where: { mahasiswaId: mid } });
            const pCount = await prisma.penilaian.count({ where: { mahasiswaId: mid } });
            const jCount = await prisma.pengajuanJudul.count({ where: { mahasiswaId: mid } });
            
            if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
        } else if (user.role === 'dosen' && user.dosen) {
            const did = user.dosen.id;
            const bCount = await prisma.bimbingan.count({ where: { dosenId: did } });
            const sCount = await prisma.sidang.count({ where: { dosenId: did } });
            const pCount = await prisma.penilaian.count({ where: { dosenId: did } });
            const jCount = await prisma.pengajuanJudul.count({ where: { dosenId: did } });
            
            if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
        }

        const force = req.query.force === 'true';
        
        if (hasActiveData && !force) {
            return res.status(400).json({ 
                message: `Tidak dapat menghapus ${user.mahasiswa?.nama || user.dosen?.nama}. User memiliki data aktif (bimbingan/sidang/tugas akhir).` 
            });
        }

        await prisma.$transaction(async (tx) => {
            const userId = parseInt(id);

            // 1. Cleanup messages and chat relations (common for all roles)
            await tx.message.deleteMany({
                where: { OR: [{ senderId: userId }, { receiverId: userId }] }
            });
            await tx.chatRoomMember.deleteMany({ where: { userId } });
            await tx.acaraComment.deleteMany({ where: { userId } });

            // 2. Cleanup role-specific data
            if (user.role === 'mahasiswa' && user.mahasiswa) {
                const mid = user.mahasiswa.id;
                await tx.bimbingan.deleteMany({ where: { mahasiswaId: mid } });
                await tx.sidang.deleteMany({ where: { mahasiswaId: mid } });
                await tx.penilaian.deleteMany({ where: { mahasiswaId: mid } });
                await tx.pengajuanJudul.deleteMany({ where: { mahasiswaId: mid } });
                await tx.acaraReadStatus.deleteMany({ where: { mahasiswaId: mid } });
                
                await tx.mahasiswa.delete({ where: { id: mid } });
            } else if (user.role === 'dosen' && user.dosen) {
                const did = user.dosen.id;
                
                // Note: Acara might have related comments and read statuses
                // but those are mostly cascaded or cleaned above if related to students
                // We should delete Acara specifically for Dosen
                const acaraIds = await tx.acara.findMany({ where: { dosenId: did }, select: { id: true } });
                const ids = acaraIds.map(a => a.id);
                if (ids.length > 0) {
                    await tx.acaraComment.deleteMany({ where: { acaraId: { in: ids } } });
                    await tx.acaraReadStatus.deleteMany({ where: { acaraId: { in: ids } } });
                    await tx.acara.deleteMany({ where: { id: { in: ids } } });
                }

                await tx.bimbingan.deleteMany({ where: { dosenId: did } });
                await tx.sidang.deleteMany({ where: { dosenId: did } });
                await tx.penilaian.deleteMany({ where: { dosenId: did } });
                await tx.pengajuanJudul.deleteMany({ where: { dosenId: did } });
                
                await tx.dosen.delete({ where: { id: did } });
            }

            // 3. Delete the base User record
            await tx.user.delete({ where: { id: userId } });
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
            password: user.password, // Include password hash so frontend can display it if needed
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

const getDashboardStats = async (req, res) => {
    try {
        const mahasiswaCount = await prisma.user.count({
            where: { role: 'mahasiswa' }
        });
        const dosenCount = await prisma.user.count({
            where: { role: 'dosen' }
        });

        // "Active Student" usually implies some status, but for now we'll return total verified if possible, 
        // or just total. User asked for "active student", "total dosen".
        // Let's assume all users in DB are "active" for now unless there's an 'isActive' flag.
        // I will return them as 'activeStudent' and 'totalDosen'.
        
        res.json({
            activeStudent: mahasiswaCount,
            totalDosen: dosenCount
        });
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = {
    createMahasiswa,
    createDosen,
    getUserCountByRole,
    getUsersByRole,
    getMonitoringData,
    updateUser,
    deleteUser,
    deleteUsersBatch,
    getUserById,
    getDashboardStats,
    createMahasiswaMassal,
    createDosenMassal
};
