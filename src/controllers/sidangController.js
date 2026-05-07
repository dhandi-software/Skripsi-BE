const prisma = require('../prisma');

const applyForSidang = async (req, res) => {
    try {
        const { mahasiswaId, judul, tanggalSidang, waktuSidang, lokasi } = req.body;
        const isStaf = req.user.role.toUpperCase() === 'STAF';
        
        let dosenId;
        let finalJudul = judul;

        // Find supervisor and title from student's approved topic
        const approvedJudul = await prisma.pengajuanJudul.findFirst({
            where: { 
                mahasiswaId: parseInt(mahasiswaId),
                status: 'APPROVED'
            }
        });

        if (isStaf) {
            if (!approvedJudul) return res.status(404).json({ message: "Supervisor not found for this student. Ensure judul is approved." });
            dosenId = approvedJudul.dosenId;
        } else {
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });
            dosenId = dosen.id;
        }

        // Auto-fill title if empty or generic
        if (!finalJudul || finalJudul.toLowerCase() === 'sdfsdf') {
            if (approvedJudul) {
                finalJudul = approvedJudul.judul;
            }
        }

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
                dosenId: dosenId,
                judul: finalJudul,
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                status: isStaf ? 'MENUNGGU_PERSETUJUAN_PEMBIMBING' : 'MENUNGGU_VERIFIKASI_KAPRODI',
                pembimbingApproved: !isStaf, // If staff applies, needs supervisor ACC
                mahasiswaSeen: false
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

        // Fetch current sidang to check if schedule already exists
        const currentSidang = await prisma.sidang.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentSidang) {
            return res.status(404).json({ message: "Data sidang tidak ditemukan." });
        }

        // If schedule is already provided by staff, jump to TERJADWAL
        const isScheduled = currentSidang.tanggalSidang && currentSidang.waktuSidang && currentSidang.lokasi;
        
        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                pembimbingApproved: true,
                prodiApproved: isScheduled ? true : currentSidang.prodiApproved,
                status: isScheduled ? 'TERJADWAL' : 'MENUNGGU_PENJADWALAN_PRODI',
                mahasiswaSeen: false // Signal update to student
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
        
        const isOfficialApproved = req.user.role.toUpperCase() === 'STAF' || (userDosen?.jabatan && (
            userDosen.jabatan.toLowerCase().includes('prodi') || 
            userDosen.jabatan.toLowerCase().includes('kepala program studi')
        ));

        // If STAFF schedules, and it was not approved by pembimbing yet, keep/set to MENUNGGU_PERSETUJUAN_PEMBIMBING
        // So the supervisor can approve the schedule set by staff.
        let newStatus = isOfficialApproved ? 'TERJADWAL' : 'MENUNGGU_KONFIRMASI_JADWAL_KAPRODI';
        
        if (req.user.role.toUpperCase() === 'STAF' && !existingSidang.pembimbingApproved) {
            newStatus = 'MENUNGGU_PERSETUJUAN_PEMBIMBING';
        }

        const sidang = await prisma.sidang.update({
            where: { id: parseInt(id) },
            data: {
                tanggalSidang: tanggalSidang ? new Date(tanggalSidang) : null,
                waktuSidang,
                lokasi,
                pengujiId: pengujiId ? parseInt(pengujiId) : null,
                prodiApproved: true,
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
    markAsSeenByMahasiswa,
    deleteSidang
};
