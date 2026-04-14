const prisma = require('../prisma');

const applyForSidang = async (req, res) => {
    try {
        const { mahasiswaId, judul, tanggalSidang, waktuSidang, lokasi } = req.body;
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

        // Check if student already has a sidang record
        const existing = await prisma.sidang.findFirst({
            where: { mahasiswaId: parseInt(mahasiswaId) }
        });

        if (existing && existing.status !== 'DITOLAK') {
            return res.status(400).json({ message: "Mahasiswa ini sudah terdaftar dalam proses persidangan." });
        }

        const sidang = await prisma.sidang.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: dosen.id,
                judul,
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                status: 'MENUNGGU_VERIFIKASI_KAPRODI',
                pembimbingApproved: true
            }
        });

        res.status(201).json(sidang);
    } catch (error) {
        console.error("Apply Sidang Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const approveByPembimbing = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                pembimbingApproved: true,
                status: 'MENUNGGU_PENJADWALAN_PRODI'
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Approve Pembimbing Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const scheduleByProdi = async (req, res) => {
    try {
        const { id } = req.params;
        const { tanggalSidang, waktuSidang, lokasi, pengujiId, catatan } = req.body;
        
        const userDosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        // Pengecekan apakah pengguna yang memanggil fungsi ini adalah Kaprodi / Penjabat Prodi
        // Jika benar Kaprodi sendiri (secara sistem) yang merubah, bernilai true
        const isOfficialApproved = userDosen?.jabatan && (
            userDosen.jabatan.toLowerCase().includes('prodi') || 
            userDosen.jabatan.toLowerCase().includes('kepala program studi')
        );

        /* 
           Update Jadwal:
           1. Jika Dosen Biasa / Koordinator KP yang mensubmit perubahan jadwal, 
              maka status akan dialihkan ke 'MENUNGGU_KONFIRMASI_JADWAL_KAPRODI' 
              agar disetujui ulang oleh Kaprodi.
           2. Jika (secara exception/bypass) Kaprodi itu sendiri yang mengubah jadwal, 
              maka statusnya akan langsung 'TERJADWAL'.
        */
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                pengujiId: pengujiId ? parseInt(pengujiId) : null,
                prodiApproved: true,
                status: isOfficialApproved ? 'TERJADWAL' : 'MENUNGGU_KONFIRMASI_JADWAL_KAPRODI',
                catatan
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Schedule Prodi Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getSidangDosen = async (req, res) => {
    try {
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

        // Basic criteria: 
        // 1. If Pejabat Prodi, see all.
        // 2. If regular Dosen, see their supervised students (Pembimbing) OR students they are Examiner for.
        
        let sidangs;
        if (dosen.jabatan && (dosen.jabatan.includes('Pejabat Prodi') || dosen.jabatan.includes('Koordinator KP'))) {
            sidangs = await prisma.sidang.findMany({
                include: {
                    mahasiswa: true,
                    dosen: true
                },
                orderBy: { updatedAt: 'desc' }
            });
        } else {
            sidangs = await prisma.sidang.findMany({
                where: {
                    OR: [
                        { dosenId: dosen.id },
                        { pengujiId: dosen.id }
                    ]
                },
                include: {
                    mahasiswa: true,
                    dosen: true
                },
                orderBy: { updatedAt: 'desc' }
            });
        }

        res.json(sidangs);
    } catch (error) {
        console.error("Get Sidang Dosen Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const prodiApprove = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                prodiApproved: true,
                status: 'MENUNGGU_KONFIRMASI_JADWAL_KAPRODI'
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Prodi Approve Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const verifyByKaprodi = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                status: 'TERJADWAL'
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Verify Kaprodi Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const confirmScheduleByKaprodi = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                status: 'TERJADWAL'
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Confirm Schedule Kaprodi Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteSidang = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.sidang.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Data sidang berhasil dihapus." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getSidangMahasiswa = async (req, res) => {
    try {
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) return res.status(404).json({ message: "Mahasiswa profile not found" });

        const sidangs = await prisma.sidang.findMany({
            where: { mahasiswaId: mahasiswa.id },
            include: {
                dosen: true, // Pembimbing
                mahasiswa: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(sidangs);
    } catch (error) {
        console.error("Get Sidang Mahasiswa Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    applyForSidang,
    approveByPembimbing,
    scheduleByProdi,
    getSidangDosen,
    getSidangMahasiswa,
    prodiApprove,
    verifyByKaprodi,
    confirmScheduleByKaprodi,
    deleteSidang
};
