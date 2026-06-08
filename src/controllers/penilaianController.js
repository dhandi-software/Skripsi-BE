const prisma = require('../prisma');

const getAllPenilaian = async (req, res) => {
    try {
        const penilaian = await prisma.penilaian.findMany({
            include: {
                mahasiswa: true,
                dosen: true
            }
        });
        res.json(penilaian);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getPenilaianByMahasiswa = async (req, res) => {
    const { mahasiswaId } = req.params;
    try {
        const penilaian = await prisma.penilaian.findMany({
            where: { mahasiswaId: parseInt(mahasiswaId) },
            include: { dosen: true }
        });
        res.json(penilaian);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all students supervised by this dosen and their detailed grades
const getPenilaianByDosen = async (req, res) => {
    try {
        let isKoordinator = false;
        let dosen = null;
        if (req.user.role === 'admin') {
            isKoordinator = true;
        } else {
            dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });

            if (!dosen) {
                return res.status(404).json({ message: "Dosen profile not found" });
            }

            isKoordinator = dosen.jabatan && (
                dosen.jabatan.includes('Pejabat Prodi') || 
                dosen.jabatan.includes('Koordinator KP') || 
                dosen.jabatan.toLowerCase().includes('koordinator')
            );
        }

        let pengajuanList;
        if (isKoordinator) {
            pengajuanList = await prisma.pengajuanJudul.findMany({
                where: { status: 'APPROVED' },
                include: {
                    mahasiswa: {
                        include: {
                            sidang: true,
                            penilaian: true
                        }
                    },
                    dosen: true // Pembimbing
                }
            });
        } else {
            // Regular Dosen: Find supervised OR examining
            const supervised = await prisma.pengajuanJudul.findMany({
                where: {
                    status: 'APPROVED',
                    dosenId: dosen.id
                },
                include: {
                    mahasiswa: {
                        include: {
                            sidang: true,
                            penilaian: true
                        }
                    },
                    dosen: true
                }
            });

            const examiningSidangs = await prisma.sidang.findMany({
                where: {
                    pengujiId: dosen.id
                },
                include: {
                    mahasiswa: {
                        include: {
                            pengajuanJudul: {
                                where: { status: 'APPROVED' },
                                take: 1
                            },
                            sidang: true,
                            penilaian: true
                        }
                    },
                    dosen: true
                }
            });

            const examining = [];
            examiningSidangs.forEach(s => {
                const mhs = s.mahasiswa;
                const p = mhs.pengajuanJudul && mhs.pengajuanJudul.length > 0 ? mhs.pengajuanJudul[0] : null;
                if (p) {
                    examining.push({
                        ...p,
                        mahasiswa: mhs,
                        dosen: s.dosen
                    });
                }
            });

            const combined = [...supervised];
            examining.forEach(ex => {
                if (!combined.some(c => c.mahasiswaId === ex.mahasiswaId)) {
                    combined.push(ex);
                }
            });

            pengajuanList = combined;
        }

        const allDosens = await prisma.dosen.findMany({
            select: { id: true, nama: true }
        });

        const result = await Promise.all(pengajuanList.map(async p => {
            const mhs = p.mahasiswa;
            const activeSidang = mhs.sidang && mhs.sidang.length > 0 ? mhs.sidang[0] : null;
            const penilaian = mhs.penilaian && mhs.penilaian.length > 0 ? mhs.penilaian[0] : null;
            
            let pengujiNama = null;
            if (activeSidang && activeSidang.pengujiId) {
                const pDosen = allDosens.find(d => d.id === activeSidang.pengujiId);
                if (pDosen) pengujiNama = pDosen.nama;
            }

            return {
                mahasiswaId: mhs.id,
                nama: mhs.nama,
                nim: mhs.nim,
                jurusan: mhs.jurusan,
                judulSkripsi: p.judul || "-",
                penilaianId: penilaian ? penilaian.id : null,
                
                // Pembimbing Info
                pembimbingId: p.dosenId,
                pembimbingNama: p.dosen ? p.dosen.nama : "-",

                // Penguji Info
                pengujiId: activeSidang ? activeSidang.pengujiId : null,
                pengujiNama: pengujiNama,

                // Detailed Components
                p1_k1: penilaian ? penilaian.p1_k1 : null,
                p1_k2: penilaian ? penilaian.p1_k2 : null,
                p1_k3: penilaian ? penilaian.p1_k3 : null,
                p1_total: penilaian ? penilaian.p1_total : null,
                p1_nama: penilaian ? penilaian.p1_nama : (p.dosen ? p.dosen.nama : ""),

                p2_k1: penilaian ? penilaian.p2_k1 : null,
                p2_k2: penilaian ? penilaian.p2_k2 : null,
                p2_k3: penilaian ? penilaian.p2_k3 : null,
                p2_total: penilaian ? penilaian.p2_total : null,
                p2_nama: penilaian ? penilaian.p2_nama : (pengujiNama || ""),

                nilai: penilaian ? penilaian.nilaiRataRata : null,
                nilaiRataRata: penilaian ? penilaian.nilaiRataRata : null,
                keterangan: penilaian ? penilaian.keterangan : null,
                tanggal: penilaian ? penilaian.tanggal : null,
                isKoordinator: isKoordinator
            };
        }));

        res.json({
            students: result,
            dosenList: allDosens,
            isKoordinator: isKoordinator
        });
    } catch (error) {
        console.error("Get Penilaian by Dosen Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const assignPenguji = async (req, res) => {
    const { mahasiswaId, pengujiId } = req.body;
    try {
        let isKoordinator = false;
        let dosen = null;
        if (req.user.role === 'admin') {
            isKoordinator = true;
        } else {
            dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

            isKoordinator = dosen.jabatan && (
                dosen.jabatan.includes('Pejabat Prodi') || 
                dosen.jabatan.includes('Koordinator KP') || 
                dosen.jabatan.toLowerCase().includes('koordinator')
            );
        }

        const approvedJudul = await prisma.pengajuanJudul.findFirst({
            where: {
                mahasiswaId: parseInt(mahasiswaId),
                status: 'APPROVED'
            }
        });

        if (!approvedJudul) {
            return res.status(400).json({ message: "Mahasiswa belum memiliki judul bimbingan yang disetujui." });
        }

        if (!isKoordinator && approvedJudul.dosenId !== dosen.id) {
            return res.status(403).json({ message: "Anda tidak berhak memilih penguji untuk mahasiswa ini." });
        }

        const existingSidang = await prisma.sidang.findFirst({
            where: { mahasiswaId: parseInt(mahasiswaId) }
        });

        if (existingSidang) {
            const updated = await prisma.sidang.update({
                where: { id: existingSidang.id },
                data: {
                    pengujiId: pengujiId ? parseInt(pengujiId) : null,
                    status: 'TERJADWAL'
                }
            });
            return res.json(updated);
        } else {
            const newSidang = await prisma.sidang.create({
                data: {
                    mahasiswaId: parseInt(mahasiswaId),
                    dosenId: approvedJudul.dosenId,
                    pengujiId: pengujiId ? parseInt(pengujiId) : null,
                    judul: approvedJudul.judul,
                    status: 'TERJADWAL'
                }
            });
            return res.json(newSidang);
        }
    } catch (error) {
        console.error("Assign Penguji Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const createPenilaian = async (req, res) => {
    const { 
        mahasiswaId, 
        p1_k1, p1_k2, p1_k3, p1_nama,
        p2_k1, p2_k2, p2_k3, p2_nama,
        keterangan 
    } = req.body;

    try {
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        const approvedJudul = await prisma.pengajuanJudul.findFirst({
            where: {
                mahasiswaId: parseInt(mahasiswaId),
                status: 'APPROVED'
            }
        });

        // Calculations
        const p1_total = p1_k1 !== undefined ? (0.35 * p1_k1 + 0.30 * p1_k2 + 0.35 * p1_k3) : null;
        const p2_total = p2_k1 !== undefined ? (0.35 * p2_k1 + 0.30 * p2_k2 + 0.35 * p2_k3) : null;
        
        let nilaiRataRata = null;
        if (p1_total !== null && p2_total !== null) {
            nilaiRataRata = (p1_total + p2_total) / 2;
        } else if (p1_total !== null) {
            nilaiRataRata = p1_total;
        } else if (p2_total !== null) {
            nilaiRataRata = p2_total;
        }

        // Check if already graded (find the single unified record for this student)
        const existing = await prisma.penilaian.findFirst({
            where: {
                mahasiswaId: parseInt(mahasiswaId)
            }
        });

        const data = {
            p1_k1: p1_k1 ? parseFloat(p1_k1) : null,
            p1_k2: p1_k2 ? parseFloat(p1_k2) : null,
            p1_k3: p1_k3 ? parseFloat(p1_k3) : null,
            p1_total: p1_total,
            p1_nama: p1_nama || null,
            p2_k1: p2_k1 ? parseFloat(p2_k1) : null,
            p2_k2: p2_k2 ? parseFloat(p2_k2) : null,
            p2_k3: p2_k3 ? parseFloat(p2_k3) : null,
            p2_total: p2_total,
            p2_nama: p2_nama || null,
            nilaiRataRata: nilaiRataRata,
            keterangan: keterangan || '',
        };

        if (existing) {
            const updated = await prisma.penilaian.update({
                where: { id: existing.id },
                data: data
            });
            return res.json(updated);
        }

        const newPenilaian = await prisma.penilaian.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: approvedJudul ? approvedJudul.dosenId : dosen.id,
                ...data
            }
        });
        res.status(201).json(newPenilaian);
    } catch (error) {
        console.error("Create Penilaian Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updatePenilaian = async (req, res) => {
    const { id } = req.params;
    const { 
        p1_k1, p1_k2, p1_k3, p1_nama,
        p2_k1, p2_k2, p2_k3, p2_nama,
        keterangan 
    } = req.body;

    try {
        const p1_total = p1_k1 !== undefined ? (0.35 * p1_k1 + 0.30 * p1_k2 + 0.35 * p1_k3) : null;
        const p2_total = p2_k1 !== undefined ? (0.35 * p2_k1 + 0.30 * p2_k2 + 0.35 * p2_k3) : null;
        
        let nilaiRataRata = null;
        if (p1_total !== null && p2_total !== null) {
            nilaiRataRata = (p1_total + p2_total) / 2;
        }

        const updated = await prisma.penilaian.update({
            where: { id: parseInt(id) },
            data: {
                p1_k1: p1_k1 ? parseFloat(p1_k1) : null,
                p1_k2: p1_k2 ? parseFloat(p1_k2) : null,
                p1_k3: p1_k3 ? parseFloat(p1_k3) : null,
                p1_total: p1_total,
                p1_nama: p1_nama || null,
                p2_k1: p2_k1 ? parseFloat(p2_k1) : null,
                p2_k2: p2_k2 ? parseFloat(p2_k2) : null,
                p2_k3: p2_k3 ? parseFloat(p2_k3) : null,
                p2_total: p2_total,
                p2_nama: p2_nama || null,
                nilaiRataRata: nilaiRataRata,
                keterangan: keterangan || ''
            }
        });
        res.json(updated);
    } catch (error) {
        console.error("Update Penilaian Error:", error);
        res.status(500).json({ error: error.message });
    }
};


const deletePenilaian = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.penilaian.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Penilaian deleted successfully" });
    } catch (error) {
        console.error("Delete Penilaian Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const assignPembimbing = async (req, res) => {
    const { mahasiswaId, pembimbingId } = req.body;
    try {
        let isKoordinator = false;
        if (req.user.role === 'admin') {
            isKoordinator = true;
        } else {
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

            isKoordinator = dosen.jabatan && (
                dosen.jabatan.includes('Pejabat Prodi') || 
                dosen.jabatan.includes('Koordinator KP') || 
                dosen.jabatan.toLowerCase().includes('koordinator')
            );
        }

        if (!isKoordinator) {
            return res.status(403).json({ message: "Anda tidak berhak menugaskan Dosen Pembimbing." });
        }

        const approvedJudul = await prisma.pengajuanJudul.findFirst({
            where: {
                mahasiswaId: parseInt(mahasiswaId),
                status: 'APPROVED'
            }
        });

        if (!approvedJudul) {
            return res.status(400).json({ message: "Mahasiswa belum memiliki judul bimbingan yang disetujui." });
        }

        const newPembimbingId = parseInt(pembimbingId);

        // Update PengajuanJudul dosenId
        await prisma.pengajuanJudul.update({
            where: { id: approvedJudul.id },
            data: { dosenId: newPembimbingId }
        });

        // Update Sidang dosenId if exists
        const existingSidang = await prisma.sidang.findFirst({
            where: { mahasiswaId: parseInt(mahasiswaId) }
        });
        if (existingSidang) {
            await prisma.sidang.update({
                where: { id: existingSidang.id },
                data: { dosenId: newPembimbingId }
            });
        }

        // Update Bimbingan dosenId if exists
        await prisma.bimbingan.updateMany({
            where: { mahasiswaId: parseInt(mahasiswaId) },
            data: { dosenId: newPembimbingId }
        });

        // Update Penilaian dosenId if exists
        await prisma.penilaian.updateMany({
            where: { mahasiswaId: parseInt(mahasiswaId) },
            data: { dosenId: newPembimbingId }
        });

        return res.json({ message: "Dosen Pembimbing berhasil diperbarui." });
    } catch (error) {
        console.error("Assign Pembimbing Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllPenilaian,
    getPenilaianByMahasiswa,
    getPenilaianByDosen,
    createPenilaian,
    updatePenilaian,
    deletePenilaian,
    assignPenguji,
    assignPembimbing
};
