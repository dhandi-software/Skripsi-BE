const prisma = require('../prisma');

const applyForSidang = async (req, res) => {
    try {
        const { judul } = req.body;
        const file = req.file;
        const isMahasiswa = req.user.role.toUpperCase() === 'MAHASISWA';

        if (!isMahasiswa) {
            return res.status(403).json({ message: "Hanya mahasiswa yang dapat mengajukan sidang." });
        }

        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) return res.status(404).json({ message: "Mahasiswa profile not found" });

        // Check active JadwalKp
        const now = new Date();
        const activeJadwal = await prisma.jadwalKp.findFirst({
            where: {
                tipe: 'PENGARAHAN_SIDANG',
                tanggal: { gte: now }
            }
        });

        if (!activeJadwal) {
            return res.status(400).json({ message: "Pendaftaran sidang belum dibuka atau sudah ditutup." });
        }

        if (!file) {
            return res.status(400).json({ message: "Laporan akhir harus diunggah." });
        }

        // Find supervisor and title from student's approved topic
        const approvedJudul = await prisma.pengajuanJudul.findFirst({
            where: { 
                mahasiswaNim: mahasiswa.nim,
                status: 'APPROVED'
            }
        });

        if (!approvedJudul) return res.status(400).json({ message: "Pengajuan judul belum disetujui, tidak bisa mendaftar sidang." });

        let finalJudul = judul;
        if (!finalJudul || finalJudul.trim() === '') {
            finalJudul = approvedJudul.judul;
        }

        // Check if student already has a sidang record
        const existing = await prisma.sidang.findFirst({
            where: { mahasiswaNim: mahasiswa.nim },
            orderBy: { createdAt: 'desc' }
        });

        if (existing && existing.status !== 'DITOLAK') {
            return res.status(400).json({ message: "Anda sudah terdaftar dalam proses persidangan." });
        }

        // If rejected, just create a new record or update. We will create a new one to keep history, or we can update.
        // Actually creating a new one is fine, as the frontend will just show the latest one.

        const sidang = await prisma.sidang.create({
            data: {
                mahasiswaNim: mahasiswa.nim,
                dosenNidn: approvedJudul.dosenNidn,
                judul: finalJudul,
                laporanUrl: `/uploads/${file.filename}`, // multer saves to uploads dir
                status: 'MENUNGGU_PERSETUJUAN_PEMBIMBING',
                pembimbingApproved: false, 
                mahasiswaSeen: true
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
        const { tanggalSidang, waktuSidang, lokasi, isRejected, catatan } = req.body;

        const currentSidang = await prisma.sidang.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentSidang) {
            return res.status(404).json({ message: "Data sidang tidak ditemukan." });
        }

        if (isRejected) {
             const sidang = await prisma.sidang.update({
                 where: { id: parseInt(id) },
                 data: {
                     status: 'DITOLAK',
                     catatan: catatan || null,
                     mahasiswaSeen: false
                 }
             });
             return res.json(sidang);
        }

        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                pembimbingApproved: true,
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                status: tanggalSidang ? 'TERJADWAL' : 'MENUNGGU_PENJADWALAN_KOORDINATOR',
                mahasiswaSeen: false
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
        
        const existingSidang = await prisma.sidang.findUnique({
            where: { id: parseInt(id) }
        });

        const userDosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        const isOfficialApproved = userDosen?.jabatan && (
            userDosen.jabatan.toLowerCase().includes('prodi') || 
            userDosen.jabatan.toLowerCase().includes('koordinator kp') ||
            userDosen.jabatan.toLowerCase().includes('kepala program studi')
        );

        if (req.user.role.toUpperCase() === 'STAF' || !isOfficialApproved) {
            return res.status(403).json({ message: "Hanya Dosen Pembimbing atau Koordinator KP yang dapat menjadwalkan sidang." });
        }

        let newStatus = 'TERJADWAL';

        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                pengujiNidn: pengujiId ? parseInt(pengujiId) : null,
                status: newStatus,
                catatan,
                mahasiswaSeen: false // Signal update to student
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
        let sidangs;
        if (req.user.role.toUpperCase() === 'STAF') {
            sidangs = await prisma.sidang.findMany({
                include: {
                    mahasiswa: true,
                    dosen: true
                },
                orderBy: { updatedAt: 'desc' }
            });
        } else {
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            
            if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

            if (
                req.user.role.toUpperCase() === 'KAPRODI' ||
                (dosen.jabatan && (
                    dosen.jabatan.includes('Pejabat Prodi') || 
                    dosen.jabatan.includes('Koordinator KP') ||
                    dosen.jabatan.toLowerCase().includes('kaprodi') ||
                    dosen.jabatan.toLowerCase().includes('kepala program studi')
                ))
            ) {
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
                            { dosenNidn: dosen.nidn },
                            { pengujiNidn: dosen.nidn }
                        ]
                    },
                    include: {
                        mahasiswa: true,
                        dosen: true
                    },
                    orderBy: { updatedAt: 'desc' }
                });
            }
        }

        res.json(sidangs);
    } catch (error) {
        console.error("Get Sidang Dosen Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// const prodiApprove = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const sidang = await prisma.sidang.update({
//             where: { id: parseInt(id) },
//             data: {
//                 prodiApproved: true,
//                 status: 'TERJADWAL'
//             }
//         });
//         res.json(sidang);
//     } catch (error) {
//         console.error("Prodi Approve Error:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

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
                status: 'TERJADWAL',
                mahasiswaSeen: false
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Confirm Schedule Kaprodi Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const markAsSeenByMahasiswa = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                mahasiswaSeen: true
            }
        });
        res.json(sidang);
    } catch (error) {
        console.error("Mark As Seen Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteSidang = async (req, res) => {
    try {
        const { id } = req.params;
        const sidang = await prisma.sidang.findUnique({ where: { id: parseInt(id) } });
        if (!sidang) return res.status(404).json({ message: "Data sidang tidak ditemukan." });

        if (req.user.role.toUpperCase() === 'MAHASISWA') {
            const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: req.user.id } });
            if (!mahasiswa || sidang.mahasiswaNim !== mahasiswa.nim) {
                return res.status(403).json({ message: "Tidak memiliki akses untuk menghapus data ini." });
            }
            if (sidang.status === 'TERJADWAL' || sidang.status === 'SELESAI') {
                return res.status(400).json({ message: "Tidak dapat membatalkan pengajuan sidang yang sudah dijadwalkan atau dikonfirmasi." });
            }
        }

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
            where: { mahasiswaNim: mahasiswa.nim },
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
    // prodiApprove,
    verifyByKaprodi,
    confirmScheduleByKaprodi,
    markAsSeenByMahasiswa,
    deleteSidang
};
