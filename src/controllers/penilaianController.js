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
            where: { mahasiswaNim: mahasiswaId },
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
                    dosenNidn: dosen.nidn
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
                    pengujiNidn: dosen.nidn
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
                if (!combined.some(c => c.mahasiswaNim === ex.mahasiswaNim)) {
                    combined.push(ex);
                }
            });

            pengajuanList = combined;
        }

        const allDosens = await prisma.dosen.findMany({
            select: { nidn: true, nama: true }
        });

        const result = await Promise.all(pengajuanList.map(async p => {
            const mhs = p.mahasiswa;
            const activeSidang = mhs.sidang && mhs.sidang.length > 0 ? mhs.sidang[0] : null;
            const penilaian = mhs.penilaian && mhs.penilaian.length > 0 ? mhs.penilaian[0] : null;
            
            let pengujiNama = null;
            if (activeSidang && activeSidang.pengujiNidn) {
                const pDosen = allDosens.find(d => d.nidn === activeSidang.pengujiNidn);
                if (pDosen) pengujiNama = pDosen.nama;
            }

            return {
                mahasiswaId: mhs.nim,
                mahasiswaNim: mhs.nim,
                nama: mhs.nama,
                nim: mhs.nim,
                judulSkripsi: p.judul || "-",
                penilaianId: penilaian ? penilaian.id : null,
                
                // Pembimbing Info
                pembimbingId: p.dosenNidn,
                pembimbingNama: p.dosen ? p.dosen.nama : "-",

                // Penguji Info
                pengujiNidn: activeSidang ? activeSidang.pengujiNidn : null,
                pengujiNama: pengujiNama,
                suratTugasUrl: activeSidang ? activeSidang.suratTugasUrl : null,

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
            dosenList: allDosens.map(d => ({ ...d, id: d.nidn })),
            isKoordinator: isKoordinator
        });
    } catch (error) {
        console.error("Get Penilaian by Dosen Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const assignPenguji = async (req, res) => {
    const { mahasiswaId, pengujiId } = req.body;
    let suratTugasUrl = null;
    
    if (req.file) {
        suratTugasUrl = `/uploads/${req.file.filename}`;
    }

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
                mahasiswaNim: mahasiswaId,
                status: 'APPROVED'
            }
        });

        if (!approvedJudul) {
            return res.status(400).json({ message: "Mahasiswa belum memiliki judul bimbingan yang disetujui." });
        }

        if (!isKoordinator) {
            return res.status(403).json({ message: "Hanya Dosen Koordinator yang berhak memberikan tugas pengujian." });
        }

        const existingSidang = await prisma.sidang.findFirst({
            where: { mahasiswaNim: mahasiswaId }
        });

        if (existingSidang) {
            const dataToUpdate = {
                pengujiNidn: pengujiId ? String(pengujiId) : null,
                status: 'TERJADWAL',
                catatan: null // Clear catatan to indicate fresh assignment
            };
            if (suratTugasUrl) {
                dataToUpdate.suratTugasUrl = suratTugasUrl;
            }

            const updated = await prisma.sidang.update({
                where: { id: existingSidang.id },
                data: dataToUpdate
            });
            return res.json(updated);
        } else {
            const dataToCreate = {
                mahasiswaNim: mahasiswaId,
                dosenNidn: approvedJudul.dosenNidn,
                pengujiNidn: pengujiId ? String(pengujiId) : null,
                judul: approvedJudul.judul,
                status: 'TERJADWAL'
            };
            if (suratTugasUrl) {
                dataToCreate.suratTugasUrl = suratTugasUrl;
            }
            const newSidang = await prisma.sidang.create({
                data: dataToCreate
            });
            return res.json(newSidang);
        }
    } catch (error) {
        console.error("Assign Penguji Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const cancelPenguji = async (req, res) => {
    const { mahasiswaId } = req.body;
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

        if (!isKoordinator) {
            return res.status(403).json({ message: "Hanya Dosen Koordinator yang berhak membatalkan tugas pengujian." });
        }

        const existingSidang = await prisma.sidang.findFirst({
            where: { mahasiswaNim: mahasiswaId }
        });

        if (existingSidang) {
            const updated = await prisma.sidang.update({
                where: { id: existingSidang.id },
                data: {
                    pengujiNidn: null,
                    status: 'BATAL',
                    catatan: 'Dibatalkan oleh Koordinator'
                }
            });
            return res.json(updated);
        } else {
            return res.status(400).json({ message: "Sidang belum terdaftar." });
        }
    } catch (error) {
        console.error("Cancel Penguji Error:", error);
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
                mahasiswaNim: mahasiswaId,
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
                mahasiswaNim: mahasiswaId
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
                mahasiswaNim: mahasiswaId,
                dosenNidn: approvedJudul ? approvedJudul.dosenNidn : dosen.nidn,
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
                mahasiswaNim: mahasiswaId,
                status: 'APPROVED'
            }
        });

        if (!approvedJudul) {
            return res.status(400).json({ message: "Mahasiswa belum memiliki judul bimbingan yang disetujui." });
        }

        const newPembimbingId = String(pembimbingId);

        // Update PengajuanJudul dosenId
        await prisma.pengajuanJudul.update({
            where: { id: approvedJudul.id },
            data: { dosenNidn: newPembimbingId }
        });

        // Update Sidang dosenId if exists
        const existingSidang = await prisma.sidang.findFirst({
            where: { mahasiswaNim: mahasiswaId }
        });
        if (existingSidang) {
            await prisma.sidang.update({
                where: { id: existingSidang.id },
                data: { dosenNidn: newPembimbingId }
            });
        }

        // Update Bimbingan dosenId if exists
        await prisma.bimbingan.updateMany({
            where: { mahasiswaNim: mahasiswaId },
            data: { dosenNidn: newPembimbingId }
        });

        // Update Penilaian dosenId if exists
        await prisma.penilaian.updateMany({
            where: { mahasiswaNim: mahasiswaId },
            data: { dosenNidn: newPembimbingId }
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
    cancelPenguji,
    assignPembimbing
};
