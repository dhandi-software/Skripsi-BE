const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const isValidEmailDomain = (email) => {
    if (!email || email.includes(" ")) return false;
    const allowedDomains = ["@student.univ.ac.id", "@univ.ac.id", "@gmail.com"];
    return allowedDomains.some(domain => email.toLowerCase().endsWith(domain));
};

const createMahasiswa = async (req, res) => {
    try {
        const { email, password, nama, nim, tahunMasuk } = req.body;

        // Basic Validation
        if (!email || !password || !nama || !nim || !tahunMasuk) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!isValidEmailDomain(email)) {
            return res.status(400).json({ message: "Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com" });
        }

        // Check if user exists (Email or NIM as Username)
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { mahasiswa: { email } },
                    { dosen: { email } },
                    { staf: { email } },
                    { username: nim }
                ]
            },
            include: { mahasiswa: true, dosen: true, staf: true }
        });

        if (existingUser) {
            const isEmail = existingUser.mahasiswa?.email === email || existingUser.dosen?.email === email || existingUser.staf?.email === email;
            const conflict = isEmail ? "Email" : "NIM (Username)";
            return res.status(400).json({ message: `${conflict} sudah terdaftar` });
        }

        const existingNim = await prisma.mahasiswa.findUnique({ where: { nim } });
        if (existingNim) {
            return res.status(400).json({ message: "NIM sudah terdaftar di profil mahasiswa" });
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
                    password: hashedPassword,
                    role: 'mahasiswa', // lowercase as per used convention
                }
            });

            const mahasiswa = await prisma.mahasiswa.create({
                data: {
                    userId: user.id,
                    nim,
                    nama,
                    email,
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

        const emails = users.map(u => u.email).filter(Boolean);
        const nims = users.map(u => u.nim).filter(Boolean);

        // Bulk validate basics
        if (emails.length !== users.length || nims.length !== users.length) {
            return res.status(400).json({ message: "All fields are required for each user in the array." });
        }

        for (const item of users) {
            if (!isValidEmailDomain(item.email)) {
                return res.status(400).json({ message: `Email ${item.email} tidak valid. Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com` });
            }
        }

        // Fetch existing users (User, Mahasiswa)
        const existingUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { mahasiswa: { email: { in: emails } } },
                    { dosen: { email: { in: emails } } },
                    { staf: { email: { in: emails } } },
                    { username: { in: nims } }
                ]
            },
            include: { mahasiswa: true, dosen: true, staf: true }
        });

        const existingNims = await prisma.mahasiswa.findMany({
            where: { nim: { in: nims } },
            select: { nim: true }
        });

        const nimSet = new Set(existingNims.map(m => m.nim));
        const emailSet = new Set(
            existingUsers.flatMap(u => [u.mahasiswa?.email, u.dosen?.email, u.staf?.email]).filter(Boolean)
        );
        const usernameSet = new Set(existingUsers.map(u => u.username));

        // Check for duplicates in the incoming array against the DB
        for (const item of users) {
            if (emailSet.has(item.email)) {
                return res.status(400).json({ message: `Data duplikat ditemukan untuk Email: ${item.email}` });
            }
            if (usernameSet.has(item.nim) || nimSet.has(item.nim)) {
                return res.status(400).json({ message: `Data duplikat ditemukan untuk NIM: ${item.nim}` });
            }
        }

        // Perform transaction
        const results = await prisma.$transaction(async (tx) => {
            const createdUsers = [];
            // Map users to promises
            const userPromises = users.map(async (item) => {
                const hashedPassword = await bcrypt.hash(item.password, 10);
                const user = await tx.user.create({
                    data: {
                        username: item.nim,
                        password: hashedPassword,
                        role: 'mahasiswa',
                    }
                });
                const mahasiswa = await tx.mahasiswa.create({
                    data: {
                        userId: user.id,
                        nim: item.nim,
                        nama: item.nama,
                        email: item.email,
                        tahunMasuk: item.tahunMasuk
                    }
                });
                return { user, mahasiswa };
            });
            
            // Wait for all creations in parallel
            return await Promise.all(userPromises);
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
        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ message: "Users array is required and must not be empty" });
        }

        for (const item of users) {
            if (!isValidEmailDomain(item.email)) {
                return res.status(400).json({ message: `Email ${item.email} tidak valid. Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com` });
            }
        }

        const normalizedUsers = users.map(u => ({
            ...u,
            identifier: u.nidn || u.nip || u.nim,
            nip: u.nip || null
        }));

        const emails = normalizedUsers.map(u => u.email).filter(Boolean);
        const identifiers = normalizedUsers.map(u => u.identifier).filter(Boolean);
        const usernames = identifiers.map(id => `D-${id}`);

        // Fetch existing users
        const existingUsers = await prisma.user.findMany({
            where: {
                OR: [
                    { mahasiswa: { email: { in: emails } } },
                    { dosen: { email: { in: emails } } },
                    { staf: { email: { in: emails } } },
                    { username: { in: usernames } }
                ]
            },
            include: { mahasiswa: true, dosen: true, staf: true }
        });

        const existingNidns = await prisma.dosen.findMany({
            where: { nidn: { in: identifiers } },
            select: { nidn: true }
        });

        const nidnSet = new Set(existingNidns.map(d => d.nidn));
        const emailSet = new Set(
            existingUsers.flatMap(u => [u.mahasiswa?.email, u.dosen?.email, u.staf?.email]).filter(Boolean)
        );
        const usernameSet = new Set(existingUsers.map(u => u.username));

        for (const item of normalizedUsers) {
            if (emailSet.has(item.email)) {
                return res.status(400).json({ message: `Data duplikat ditemukan untuk Email: ${item.email}` });
            }
            if (usernameSet.has(`D-${item.identifier}`) || nidnSet.has(item.identifier)) {
                return res.status(400).json({ message: `Data duplikat ditemukan untuk NIDN: ${item.identifier}` });
            }
        }

        const results = await prisma.$transaction(async (tx) => {
            const userPromises = normalizedUsers.map(async (item) => {
                const hashedPassword = await bcrypt.hash(item.password, 10);
                const dosenUsername = `D-${item.identifier}`;
                
                const user = await tx.user.create({
                    data: {
                        username: dosenUsername,
                        password: hashedPassword,
                        role: 'dosen',
                    }
                });

                const dosen = await tx.dosen.create({
                    data: {
                        userId: user.id,
                        nidn: item.identifier,
                        nip: item.nip,
                        email: item.email,
                        nama: item.nama,
                        jabatan: item.jabatan || "Dosen"
                    }
                });
                return { user, dosen };
            });
            return await Promise.all(userPromises);
        });

        res.status(201).json({ message: "Dosen accounts created successfully", count: results.length });

    } catch (error) {
        console.error("Error creating mass dosen:", error);
        res.status(500).json({ message: error.message || "Internal Server Error" });
    }
};

const createDosen = async (req, res) => {
    try {
        const { email, password, nama, nidn, nip, jabatan, peminatan } = req.body;

        // Basic Validation
        if (!email || !password || !nama || !nidn || !jabatan) {
            return res.status(400).json({ message: "Semua field yang diperlukan harus diisi" });
        }

        if (!isValidEmailDomain(email)) {
            return res.status(400).json({ message: "Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com" });
        }

        // Check if user exists (Email or D-NIDN as Username)
        const dosenUsername = `D-${nidn}`;
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { mahasiswa: { email } },
                    { dosen: { email } },
                    { staf: { email } },
                    { username: dosenUsername }
                ]
            },
            include: { mahasiswa: true, dosen: true, staf: true }
        });

        if (existingUser) {
            const isEmail = existingUser.mahasiswa?.email === email || existingUser.dosen?.email === email || existingUser.staf?.email === email;
            const conflict = isEmail ? "Email" : "NIDN (Username)";
            return res.status(400).json({ message: `${conflict} sudah terdaftar` });
        }

        const existingNidn = await prisma.dosen.findUnique({ where: { nidn } });
        if (existingNidn) {
            return res.status(400).json({ message: "NIDN sudah terdaftar di profil dosen" });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    username: dosenUsername, // Use D- prefix
                    password: hashedPassword,
                    role: 'dosen',
                }
            });

            const dosen = await prisma.dosen.create({
                data: {
                    userId: user.id,
                    nidn,
                    nip: nip || null,
                    email,
                    nama,
                    jabatan,
                    peminatan: peminatan || []
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

const createStaf = async (req, res) => {
    try {
        const { email, password, nama, nip } = req.body;

        // Basic Validation
        if (!email || !password || !nama || !nip) {
            return res.status(400).json({ message: "Email, password, nama, and nip are required" });
        }

        if (!isValidEmailDomain(email)) {
            return res.status(400).json({ message: "Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com" });
        }

        // Check if user exists (Email as Username)
        const stafUsername = `S-${email.split('@')[0]}`;
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { mahasiswa: { email } },
                    { dosen: { email } },
                    { staf: { email } },
                    { username: stafUsername }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({ message: `Email atau username sudah terdaftar` });
        }

        const existingNip = await prisma.staf.findUnique({ where: { nip } });
        if (existingNip) {
            return res.status(400).json({ message: "NIP sudah terdaftar di profil staf" });
        }

        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Transaction
        const result = await prisma.$transaction(async (prisma) => {
            const user = await prisma.user.create({
                data: {
                    username: stafUsername,
                    password: hashedPassword,
                    role: 'staf',
                }
            });

            const staf = await prisma.staf.create({
                data: {
                    userId: user.id,
                    nip,
                    nama,
                    email
                }
            });

            return { user, staf };
        });

        res.status(201).json({ message: "Staf account created successfully", data: result });

    } catch (error) {
        console.error("Error creating staf:", error);
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
        const { role, page = 1, limit = 10, search = '' } = req.query;
        if (!role) return res.status(400).json({ message: "Role is required" });

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const lowerRole = role.toLowerCase();

        // Build generic search condition
        const searchCondition = search ? {
            OR: [
                { nama: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: "insensitive" } }
            ]
        } : {};

        let users;
        let total = 0;

        if (lowerRole === 'mahasiswa') {
            const mhsWhere = { ...searchCondition };
            if (search) {
                mhsWhere.OR.push({ nim: { contains: search, mode: 'insensitive' } });
            }
            [users, total] = await Promise.all([
                prisma.mahasiswa.findMany({
                    where: mhsWhere,
                    skip,
                    take,
                    include: { user: { select: { id: true, username: true } } },
                    orderBy: { nama: 'asc' }
                }),
                prisma.mahasiswa.count({ where: mhsWhere })
            ]);
        } else if (lowerRole === 'dosen') {
            const dosenWhere = { ...searchCondition };
            if (search) {
                dosenWhere.OR.push({ nidn: { contains: search, mode: 'insensitive' } });
            }
            [users, total] = await Promise.all([
                prisma.dosen.findMany({
                    where: dosenWhere,
                    skip,
                    take,
                    include: { user: { select: { id: true, username: true } } },
                    orderBy: { nama: 'asc' }
                }),
                prisma.dosen.count({ where: dosenWhere })
            ]);
        } else if (lowerRole === 'staf') {
            [users, total] = await Promise.all([
                prisma.staf.findMany({
                    where: searchCondition,
                    skip,
                    take,
                    include: { user: { select: { id: true, username: true } } },
                    orderBy: { nama: 'asc' }
                }),
                prisma.staf.count({ where: searchCondition })
            ]);
        } else {
            // Direct User table query fallback
            const userWhere = { role: lowerRole };
            if (search) {
                userWhere.OR = [
                    { username: { contains: search, mode: 'insensitive' } }
                ];
            }
            [users, total] = await Promise.all([
                prisma.user.findMany({
                    where: userWhere,
                    skip,
                    take,
                    select: { id: true, username: true, role: true },
                    orderBy: { username: 'asc' }
                }),
                prisma.user.count({ where: userWhere })
            ]);
        }

        res.json({ 
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getMonitoringData = async (req, res) => {
    try {
        const { search = '', statusBimbingan = '', page = '1', limit = '10' } = req.query;
        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        let whereCondition = {};
        
        if (statusBimbingan === 'SUDAH') {
            whereCondition.bimbingan = { some: {} };
        } else if (statusBimbingan === 'BELUM') {
            whereCondition.bimbingan = { none: {} };
        }

        if (search) {
            whereCondition.OR = [
                { nama: { contains: search, mode: 'insensitive' } },
                { nidn: { contains: search, mode: 'insensitive' } },
                {
                    bimbingan: {
                        some: {
                            mahasiswa: {
                                OR: [
                                    { nama: { contains: search, mode: 'insensitive' } },
                                    { nim: { contains: search, mode: 'insensitive' } }
                                ]
                            }
                        }
                    }
                }
            ];
        }

        const total = await prisma.dosen.count({ where: whereCondition });

        const dosens = await prisma.dosen.findMany({
            where: whereCondition,
            skip,
            take: limitNumber,
            orderBy: {
                bimbingan: {
                    _count: 'desc'
                }
            },
            select: {
                nama: true,
                nidn: true,
                jabatan: true,
                email: true,
                user: {
                    select: { id: true }
                },
                bimbingan: {
                    select: {
                        id: true,
                        topik: true,
                        status: true,
                        tanggal: true,
                        mahasiswa: {
                            select: {
                                nama: true,
                                nim: true,
                                pengajuanJudul: {
                                    where: { status: 'APPROVED' },
                                    select: { judul: true },
                                    take: 1
                                },
                                sidang: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 1,
                                    select: { pengujiNidn: true }
                                }
                            }
                        }
                    },
                    orderBy: {
                        tanggal: 'desc'
                    }
                }
            }
        });

        // Fetch all dosens to map pengujiNidn to nama
        const allDosens = await prisma.dosen.findMany({ select: { nidn: true, nama: true } });
        const dosenMap = new Map(allDosens.map(d => [d.nidn, d.nama]));

        let data = dosens.map(dosen => {
            const studentMap = new Map();
            
            dosen.bimbingan.forEach(b => {
                const mhs = b.mahasiswa;
                if (!studentMap.has(mhs.nim)) {
                    const approvedJudul = mhs.pengajuanJudul && mhs.pengajuanJudul.length > 0 
                        ? mhs.pengajuanJudul[0].judul 
                        : null;

                    const pengujiNidn = mhs.sidang && mhs.sidang.length > 0 ? mhs.sidang[0].pengujiNidn : null;
                    const pengujiNama = pengujiNidn ? dosenMap.get(pengujiNidn) || pengujiNidn : null;

                    studentMap.set(mhs.nim, {
                        id: mhs.nim,
                        nama: mhs.nama,
                        nim: mhs.nim,
                        judulSkripsi: approvedJudul || b.topik || "Belum mengajukan judul",
                        status: b.status,
                        lastBimbingan: b.tanggal,
                        pengujiNidn: pengujiNidn,
                        pengujiNama: pengujiNama
                    });
                }
            });

            let mahasiswaBimbingan = Array.from(studentMap.values());
            
            if (search) {
                const searchLower = search.toLowerCase();
                const dosenMatch = dosen.nama.toLowerCase().includes(searchLower) || dosen.nidn.toLowerCase().includes(searchLower);
                if (!dosenMatch) {
                    mahasiswaBimbingan = mahasiswaBimbingan.filter(m => 
                        m.nama.toLowerCase().includes(searchLower) || m.nim.toLowerCase().includes(searchLower)
                    );
                }
            }

            return {
                id: dosen.nidn,
                nama: dosen.nama,
                nidn: dosen.nidn,
                email: dosen.email,
                jabatan: dosen.jabatan,
                totalBimbingan: dosen.bimbingan.length,
                totalMahasiswa: studentMap.size,
                mahasiswaBimbingan: mahasiswaBimbingan
            };
        });

        // Filter out empty dosens if they only matched through a student that was filtered out
        // (This should theoretically not remove any Dosen based on our DB whereCondition)
        if (search) {
            data = data.filter(d => {
                const dosenMatch = d.nama.toLowerCase().includes(search.toLowerCase()) || d.nidn.toLowerCase().includes(search.toLowerCase());
                return dosenMatch || d.mahasiswaBimbingan.length > 0;
            });
        }

        res.json({
            data,
            meta: {
                total,
                page: pageNumber,
                totalPages: Math.ceil(total / limitNumber)
            }
        });
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

        if (email && !isValidEmailDomain(email)) {
            return res.status(400).json({ message: "Email harus berakhiran @student.univ.ac.id, @univ.ac.id, atau @gmail.com" });
        }

        const updateData = {};
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
                         email: email || undefined,
                         nomorTelepon: profileData.nomorTelepon,
                         tahunMasuk: profileData.tahunMasuk
                     }
                 });
             } else if (user.role === 'dosen') {
                 await prisma.dosen.update({
                     where: { userId: parseInt(id) },
                     data: {
                         nama: profileData.name || profileData.nama,
                         nidn: profileData.nidn,
                         nip: profileData.nip,
                         email: email || undefined,
                         nomorTelepon: profileData.nomorTelepon,
                         jabatan: profileData.jabatan
                     }
                 });
             } else if (user.role === 'staf') {
                 await prisma.staf.update({
                     where: { userId: parseInt(id) },
                     data: {
                         nama: profileData.name || profileData.nama,
                         email: email || undefined,
                         nomorTelepon: profileData.nomorTelepon
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
                    const mid = user.mahasiswa.nim;
                    const bCount = await prisma.bimbingan.count({ where: { mahasiswaNim: mid } });
                    const sCount = await prisma.sidang.count({ where: { mahasiswaNim: mid } });
                    const pCount = await prisma.penilaian.count({ where: { mahasiswaNim: mid } });
                    const jCount = await prisma.pengajuanJudul.count({ where: { mahasiswaNim: mid } });
                    
                    if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
                } else if (user.role === 'dosen' && user.dosen) {
                    const did = user.dosen.nidn;
                    const bCount = await prisma.bimbingan.count({ where: { dosenNidn: did } });
                    const sCount = await prisma.sidang.count({ where: { dosenNidn: did } });
                    const pCount = await prisma.penilaian.count({ where: { dosenNidn: did } });
                    const jCount = await prisma.pengajuanJudul.count({ where: { dosenNidn: did } });
                    
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
                    } else if (user.role === 'staf') {
                        await tx.staf.deleteMany({ where: { userId: parseInt(id) } });
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
            const mid = user.mahasiswa.nim;
            const bCount = await prisma.bimbingan.count({ where: { mahasiswaNim: mid } });
            const sCount = await prisma.sidang.count({ where: { mahasiswaNim: mid } });
            const pCount = await prisma.penilaian.count({ where: { mahasiswaNim: mid } });
            const jCount = await prisma.pengajuanJudul.count({ where: { mahasiswaNim: mid } });
            
            if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
        } else if (user.role === 'dosen' && user.dosen) {
            const did = user.dosen.nidn;
            const bCount = await prisma.bimbingan.count({ where: { dosenNidn: did } });
            const sCount = await prisma.sidang.count({ where: { dosenNidn: did } });
            const pCount = await prisma.penilaian.count({ where: { dosenNidn: did } });
            const jCount = await prisma.pengajuanJudul.count({ where: { dosenNidn: did } });
            
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
                const mid = user.mahasiswa.nim;
                await tx.bimbingan.deleteMany({ where: { mahasiswaNim: mid } });
                await tx.sidang.deleteMany({ where: { mahasiswaNim: mid } });
                await tx.penilaian.deleteMany({ where: { mahasiswaNim: mid } });
                await tx.pengajuanJudul.deleteMany({ where: { mahasiswaNim: mid } });
                await tx.acaraReadStatus.deleteMany({ where: { mahasiswaNim: mid } });
                
                await tx.mahasiswa.delete({ where: { nim: mid } });
            } else if (user.role === 'dosen' && user.dosen) {
                const did = user.dosen.nidn;
                
                // Note: Acara might have related comments and read statuses
                // but those are mostly cascaded or cleaned above if related to students
                // We should delete Acara specifically for Dosen
                const acaraIds = await tx.acara.findMany({ where: { dosenNidn: did }, select: { id: true } });
                const ids = acaraIds.map(a => a.id);
                if (ids.length > 0) {
                    await tx.acaraComment.deleteMany({ where: { acaraId: { in: ids } } });
                    await tx.acaraReadStatus.deleteMany({ where: { acaraId: { in: ids } } });
                    await tx.acara.deleteMany({ where: { id: { in: ids } } });
                }

                await tx.bimbingan.deleteMany({ where: { dosenNidn: did } });
                await tx.sidang.deleteMany({ where: { dosenNidn: did } });
                await tx.penilaian.deleteMany({ where: { dosenNidn: did } });
                await tx.pengajuanJudul.deleteMany({ where: { dosenNidn: did } });
                
                await tx.dosen.delete({ where: { nidn: did } });
            } else if (user.role === 'staf' && user.staf) {
                await tx.staf.delete({ where: { nip: user.staf.nip } });
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
                dosen: true,
                staf: true
            }
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Flatten the structure for easier frontend consumption
        let userData = {
            id: user.id,
            email: user.mahasiswa?.email || user.dosen?.email || user.staf?.email || "-",
            role: user.role,
            password: user.password, // Include password hash so frontend can display it if needed
            ... (user.mahasiswa ? user.mahasiswa : {}),
            ... (user.dosen ? user.dosen : {}),
            ... (user.staf ? user.staf : {})
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

const deleteAllMahasiswa = async (req, res) => {
    try {
        const { forceAll } = req.body;

        const allStudents = await prisma.user.findMany({
            where: { role: 'mahasiswa' },
            include: { mahasiswa: true }
        });

        if (allStudents.length === 0) {
            return res.status(400).json({ message: "Tidak ada data mahasiswa untuk dihapus." });
        }

        const studentsWithActiveData = [];
        const studentsWithoutActiveData = [];

        for (const user of allStudents) {
            let hasActiveData = false;
            if (user.mahasiswa) {
                const mid = user.mahasiswa.nim;
                const bCount = await prisma.bimbingan.count({ where: { mahasiswaNim: mid } });
                const sCount = await prisma.sidang.count({ where: { mahasiswaNim: mid } });
                const pCount = await prisma.penilaian.count({ where: { mahasiswaNim: mid } });
                const jCount = await prisma.pengajuanJudul.count({ where: { mahasiswaNim: mid } });
                
                if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
            }

            if (hasActiveData) {
                studentsWithActiveData.push(user);
            } else {
                studentsWithoutActiveData.push(user);
            }
        }

        // Case 1: Jika ada mahasiswa yang tidak memiliki data bimbingan/aktif
        if (studentsWithoutActiveData.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const user of studentsWithoutActiveData) {
                    const userId = user.id;
                    // Hapus data terkait dasar (chat, dll)
                    await tx.message.deleteMany({
                        where: { OR: [{ senderId: userId }, { receiverId: userId }] }
                    });
                    await tx.chatRoomMember.deleteMany({ where: { userId } });
                    await tx.acaraComment.deleteMany({ where: { userId } });

                    if (user.mahasiswa) {
                        const mid = user.mahasiswa.nim;
                        await tx.acaraReadStatus.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.mahasiswa.delete({ where: { nim: mid } });
                    }
                    await tx.user.delete({ where: { id: userId } });
                }
            });

            const deletedCount = studentsWithoutActiveData.length;
            const skippedCount = studentsWithActiveData.length;
            let message = `${deletedCount} akun mahasiswa tanpa bimbingan berhasil dihapus.`;
            if (skippedCount > 0) {
                message += ` ${skippedCount} akun dilewati karena memiliki data aktif.`;
            }

            return res.json({ message, deletedCount, partialSuccess: skippedCount > 0 });
        }

        // Case 2: Semua mahasiswa yang tersisa memiliki data aktif
        // Jika belum konfirmasi paksa (Validasi 2) dari backend
        if (!forceAll) {
            return res.status(400).json({ 
                requireForceAll: true, 
                message: "Semua akun mahasiswa yang tersisa memiliki data bimbingan aktif. Butuh validasi untuk menghapus seluruh data." 
            });
        }

        // Case 3: Konfirmasi force terkirim, hapus semuanya (benar-benar semuanya)
        if (forceAll === true) {
            await prisma.$transaction(async (tx) => {
                for (const user of allStudents) {
                    const userId = user.id;
                    
                    await tx.message.deleteMany({
                        where: { OR: [{ senderId: userId }, { receiverId: userId }] }
                    });
                    await tx.chatRoomMember.deleteMany({ where: { userId } });
                    await tx.acaraComment.deleteMany({ where: { userId } });

                    if (user.mahasiswa) {
                        const mid = user.mahasiswa.nim;
                        await tx.bimbingan.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.sidang.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.penilaian.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.pengajuanJudul.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.acaraReadStatus.deleteMany({ where: { mahasiswaNim: mid } });
                        await tx.mahasiswa.delete({ where: { nim: mid } });
                    }
                    await tx.user.delete({ where: { id: userId } });
                }
            });

            return res.json({ message: "Semua akun mahasiswa beserta data bimbingannya berhasil dihapus secara paksa." });
        }
    } catch (error) {
        console.error("Error clearing all mahasiswa:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const deleteAllDosen = async (req, res) => {
    try {
        const { forceAll } = req.body;

        const allLecturers = await prisma.user.findMany({
            where: { role: 'dosen' },
            include: { dosen: true }
        });

        if (allLecturers.length === 0) {
            return res.status(400).json({ message: "Tidak ada data dosen untuk dihapus." });
        }

        const dosenWithActiveData = [];
        const dosenWithoutActiveData = [];

        for (const user of allLecturers) {
            let hasActiveData = false;
            if (user.dosen) {
                const did = user.dosen.nidn;
                const bCount = await prisma.bimbingan.count({ where: { dosenNidn: did } });
                const sCount = await prisma.sidang.count({ where: { dosenNidn: did } });
                const pCount = await prisma.penilaian.count({ where: { dosenNidn: did } });
                const jCount = await prisma.pengajuanJudul.count({ where: { dosenNidn: did } });
                
                if (bCount > 0 || sCount > 0 || pCount > 0 || jCount > 0) hasActiveData = true;
            }

            if (hasActiveData) {
                dosenWithActiveData.push(user);
            } else {
                dosenWithoutActiveData.push(user);
            }
        }

        if (dosenWithoutActiveData.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const user of dosenWithoutActiveData) {
                    const userId = user.id;
                    await tx.message.deleteMany({
                        where: { OR: [{ senderId: userId }, { receiverId: userId }] }
                    });
                    await tx.chatRoomMember.deleteMany({ where: { userId } });
                    await tx.acaraComment.deleteMany({ where: { userId } });

                    if (user.dosen) {
                        const did = user.dosen.nidn;
                        const acaraIds = await tx.acara.findMany({ where: { dosenNidn: did }, select: { id: true } });
                        const ids = acaraIds.map(a => a.id);
                        if (ids.length > 0) {
                            await tx.acaraComment.deleteMany({ where: { acaraId: { in: ids } } });
                            await tx.acaraReadStatus.deleteMany({ where: { acaraId: { in: ids } } });
                            await tx.acara.deleteMany({ where: { id: { in: ids } } });
                        }
                        await tx.dosen.delete({ where: { nidn: did } });
                    }
                    await tx.user.delete({ where: { id: userId } });
                }
            });

            const deletedCount = dosenWithoutActiveData.length;
            const skippedCount = dosenWithActiveData.length;
            let message = `${deletedCount} akun dosen tanpa bimbingan berhasil dihapus.`;
            if (skippedCount > 0) {
                message += ` ${skippedCount} akun dilewati karena memiliki data aktif.`;
            }

            return res.json({ message, deletedCount, partialSuccess: skippedCount > 0 });
        }

        if (!forceAll) {
            return res.status(400).json({ 
                requireForceAll: true, 
                message: "Semua akun dosen yang tersisa memiliki data bimbingan aktif. Butuh validasi untuk menghapus seluruh data." 
            });
        }

        if (forceAll === true) {
            await prisma.$transaction(async (tx) => {
                for (const user of allLecturers) {
                    const userId = user.id;
                    
                    await tx.message.deleteMany({
                        where: { OR: [{ senderId: userId }, { receiverId: userId }] }
                    });
                    await tx.chatRoomMember.deleteMany({ where: { userId } });
                    await tx.acaraComment.deleteMany({ where: { userId } });

                    if (user.dosen) {
                        const did = user.dosen.nidn;
                        
                        const acaraIds = await tx.acara.findMany({ where: { dosenNidn: did }, select: { id: true } });
                        const ids = acaraIds.map(a => a.id);
                        if (ids.length > 0) {
                            await tx.acaraComment.deleteMany({ where: { acaraId: { in: ids } } });
                            await tx.acaraReadStatus.deleteMany({ where: { acaraId: { in: ids } } });
                            await tx.acara.deleteMany({ where: { id: { in: ids } } });
                        }

                        await tx.bimbingan.deleteMany({ where: { dosenNidn: did } });
                        await tx.sidang.deleteMany({ where: { dosenNidn: did } });
                        await tx.penilaian.deleteMany({ where: { dosenNidn: did } });
                        await tx.pengajuanJudul.deleteMany({ where: { dosenNidn: did } });
                        await tx.dosen.delete({ where: { nidn: did } });
                    }
                    await tx.user.delete({ where: { id: userId } });
                }
            });

            return res.json({ message: "Semua akun dosen beserta data akademiknya berhasil dihapus secara paksa." });
        }
    } catch (error) {
        console.error("Error clearing all dosen:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const getMahasiswaSudahPengajuan = async (req, res) => {
    try {
        const pengajuanList = await prisma.pengajuanJudul.findMany({
            include: {
                mahasiswa: true,
                dosen: true
            },
            orderBy: {
                tanggal: 'desc'
            }
        });

        res.json({ data: pengajuanList });
    } catch (error) {
        console.error("Error fetching students with proposal:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getMahasiswaTanpaPengajuan = async (req, res) => {
    try {
        const students = await prisma.mahasiswa.findMany({
            where: {
                pengajuanJudul: {
                    none: {}
                }
            },
            include: {
                user: {
                    select: { id: true }
                }
            }
        });

        res.json({ data: students });
    } catch (error) {
        console.error("Error fetching students without proposal:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = {
    createMahasiswa,
    createMahasiswaMassal,
    createDosenMassal,
    createDosen,
    createStaf,
    getUserCountByRole,
    getUsersByRole,
    updateUser,
    deleteUsersBatch,
    deleteUser,
    getMonitoringData,
    getUserById,
    getDashboardStats,
    deleteAllMahasiswa,
    deleteAllDosen,
    getMahasiswaTanpaPengajuan,
    getMahasiswaSudahPengajuan
};
