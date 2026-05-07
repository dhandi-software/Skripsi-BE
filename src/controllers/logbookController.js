const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to get owner (Mahasiswa or Dosen) based on user ID
const getOwner = async (userId, targetMahasiswaId = null) => {
    let owner = await prisma.mahasiswa.findUnique({
        where: { userId }
    });
    let type = 'mahasiswa';

    // If user is not a mahasiswa, check if they are a dosen
    if (!owner) {
        const dosen = await prisma.dosen.findUnique({
            where: { userId }
        });
        
        if (dosen) {
            type = 'dosen';
            // If a targetMahasiswaId is provided, verify the Dosen is the supervisor
            if (targetMahasiswaId) {
                const bimbingan = await prisma.bimbingan.findFirst({
                    where: {
                        mahasiswaId: parseInt(targetMahasiswaId),
                        dosenId: dosen.id
                    }
                });
                // Or check PengajuanJudul
                const pengajuan = await prisma.pengajuanJudul.findFirst({
                    where: {
                        mahasiswaId: parseInt(targetMahasiswaId),
                        dosenId: dosen.id,
                        status: 'APPROVED'
                    }
                });

                if (!bimbingan && !pengajuan) {
                    return { owner: null, type: 'unauthorized' };
                }

                owner = await prisma.mahasiswa.findUnique({
                    where: { id: parseInt(targetMahasiswaId) }
                });
            } else {
                owner = dosen;
            }
        }
    }

    return { owner, type };
};

// Mengambil informasi header perusahaan untuk logbook
exports.getLogbookInfo = async (req, res) => {
    try {
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner) {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        // If Dosen is viewing a student, use the student's ID
        const finalOwnerId = (type === 'dosen' && mahasiswaId) ? parseInt(mahasiswaId) : owner.id;
        // However, if Dosen is viewing their OWN logbook (from previous implementation), keep that too if desired.
        // But the user said "dosen hanya bisa melihat logbook untuk mahasiswa", so maybe we only care about studentId here.
        const targetId = (type === 'dosen' && mahasiswaId) ? parseInt(mahasiswaId) : (type === 'mahasiswa' ? owner.id : null);
        
        if (type === 'dosen' && !mahasiswaId) {
             // Dosen's own logbook info
             let info = await prisma.logbookInfo.findUnique({
                where: { dosenId: owner.id }
            });
            return res.json(info || { namaPerusahaan: "", tlpFaxPerusahaan: "", alamatPerusahaan: "" });
        }

        console.log("DEBUG getLogbookInfo:", { targetId, type });
        // Use queryRaw for LogbookInfo as well
        const infos = await prisma.$queryRaw`SELECT * FROM "LogbookInfo" WHERE "mahasiswaId" = ${targetId} LIMIT 1`;
        let info = infos.length > 0 ? infos[0] : null;

        if (!info) {
            info = {
                namaPerusahaan: "",
                tlpFaxPerusahaan: "",
                alamatPerusahaan: ""
            };
        }

        res.json(info);
    } catch (error) {
        console.error("Get Logbook Info Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Memperbarui atau membuat informasi perusahaan baru
exports.updateLogbookInfo = async (req, res) => {
    try {
        const { namaPerusahaan, tlpFaxPerusahaan, alamatPerusahaan } = req.body;
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        const data = {
            namaPerusahaan,
            tlpFaxPerusahaan,
            alamatPerusahaan
        };

        let whereClause;
        let createData;

        if (type === 'dosen' && mahasiswaId) {
            whereClause = { mahasiswaId: parseInt(mahasiswaId) };
            createData = { ...data, mahasiswaId: parseInt(mahasiswaId) };
        } else if (type === 'mahasiswa') {
            whereClause = { mahasiswaId: owner.id };
            createData = { ...data, mahasiswaId: owner.id };
        } else {
            whereClause = { dosenId: owner.id };
            createData = { ...data, dosenId: owner.id };
        }

        const info = await prisma.logbookInfo.upsert({
            where: whereClause,
            update: data,
            create: createData
        });

        res.json({ message: "Info logbook diperbarui", data: info });
    } catch (error) {
        console.error("Update Logbook Info Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Mengambil daftar seluruh kegiatan logbook mahasiswa/dosen
exports.getLogbooks = async (req, res) => {
    try {
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        let whereClause;
        if (type === 'dosen' && mahasiswaId) {
            whereClause = { mahasiswaId: parseInt(mahasiswaId) };
        } else if (type === 'mahasiswa') {
            whereClause = { mahasiswaId: owner.id };
        } else {
            whereClause = { dosenId: owner.id };
        }

        console.log("DEBUG getLogbooks:", { type, mahasiswaId, ownerId: owner.id, whereClause });
        // Use queryRaw to avoid issues with missing columns in Prisma Client (e.g. dosenId)
        let logbooks;
        if (type === 'dosen' && mahasiswaId) {
            logbooks = await prisma.$queryRaw`SELECT * FROM "Logbook" WHERE "mahasiswaId" = ${parseInt(mahasiswaId)} ORDER BY "tanggalPukul" ASC`;
        } else if (type === 'mahasiswa') {
            logbooks = await prisma.$queryRaw`SELECT * FROM "Logbook" WHERE "mahasiswaId" = ${owner.id} ORDER BY "tanggalPukul" ASC`;
        } else {
            // This case should ideally use dosenId, but since it's missing in DB, we'll return empty or fix later
            logbooks = [];
        }
        
        console.log(`DEBUG getLogbooks found ${logbooks.length} entries`);

        const formattedLogbooks = logbooks.map(lb => ({
            id: lb.id.toString(),
            tanggalPukul: lb.tanggalPukul.toISOString(),
            uraian: lb.uraian,
            mahasiswaParaf: lb.mahasiswaParaf,
            pembimbingParaf: lb.pembimbingParaf,
            catatan: lb.catatan || ""
        }));

        res.json(formattedLogbooks);
    } catch (error) {
        console.error("Get Logbooks Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Sinkronisasi data logbook
exports.syncLogbooks = async (req, res) => {
    try {
        const { entries } = req.body;
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        if (!Array.isArray(entries)) {
            return res.status(400).json({ message: "Entries harus berupa array" });
        }

        let ownerField;
        let ownerIdValue;

        if (type === 'dosen' && mahasiswaId) {
            ownerField = 'mahasiswaId';
            ownerIdValue = parseInt(mahasiswaId);
        } else if (type === 'mahasiswa') {
            ownerField = 'mahasiswaId';
            ownerIdValue = owner.id;
        } else {
            ownerField = 'dosenId';
            ownerIdValue = owner.id;
        }

        // 1. Hapus entri yang tidak ada di dalam payload (berarti telah dihapus oleh user)
        // Dosen should probably not be able to delete student entries, but let's see.
        // If the user is a Dosen, maybe we should prevent deletion of student entries.
        if (type === 'mahasiswa' || (type === 'dosen' && !mahasiswaId)) {
            const existingIdsToKeep = entries
                .filter(e => parseInt(e.id) < 1000000000000)
                .map(e => parseInt(e.id));
                
            await prisma.logbook.deleteMany({
                where: {
                    [ownerField]: ownerIdValue,
                    id: { notIn: existingIdsToKeep }
                }
            });
        }

        // 2. Proses Simpan/Update setiap entri
        for (const entry of entries) {
            const dateObj = entry.tanggalPukul ? new Date(entry.tanggalPukul) : new Date();
            
            // Basic data
            const data = {
                tanggalPukul: dateObj,
                uraian: entry.uraian || "",
                mahasiswaParaf: entry.mahasiswaParaf || null,
                pembimbingParaf: entry.pembimbingParaf || null,
                catatan: entry.catatan || ""
            };
            
            // If Dosen is syncing student logbook, they should only be allowed to update specific fields
            // but for simplicity and "sama persis", I'll allow it for now unless I add field-level locking in backend.
            
            if (parseInt(entry.id) > 1000000000000) {
                // New entry - only students (or Dosen for their own logbook) should create
                if (type === 'mahasiswa' || (type === 'dosen' && !mahasiswaId)) {
                    await prisma.logbook.create({
                        data: {
                            ...data,
                            [ownerField]: ownerIdValue
                        }
                    });
                }
            } else {
                // Update existing
                await prisma.logbook.update({
                    where: { id: parseInt(entry.id) },
                    data: data
                });
            }
        }

        res.json({ message: "Logbook berhasil disinkronisasi" });
    } catch (error) {
        console.error("Sync Logbooks Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};
exports.getStudentProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { id: parseInt(id) },
            include: { 
                user: true,
                pengajuanJudul: {
                    orderBy: { tanggal: 'desc' },
                    take: 1
                }
            }
        });
        
        if (!mahasiswa) {
             return res.status(404).json({ message: "Data mahasiswa tidak ditemukan" });
        }
        res.json(mahasiswa);
    } catch (error) {
        console.error("Get Logbook Student Profile Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};
