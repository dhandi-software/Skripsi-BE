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
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        // Get all students who have a scheduled sidang where THIS dosen is the supervisor or penguji
        const sidangList = await prisma.sidang.findMany({
            where: {
                OR: [
                    { dosenId: dosen.id },
                    { pengujiId: dosen.id }
                ],
                status: 'TERJADWAL'
            },
            include: {
                mahasiswa: {
                    include: {
                        pengajuanJudul: {
                            where: { status: 'APPROVED' },
                            take: 1
                        },
                        penilaian: {
                            where: { dosenId: dosen.id }
                        }
                    }
                }
            }
        });

        const result = sidangList.map(s => {
            const mhs = s.mahasiswa;
            const p = mhs.pengajuanJudul && mhs.pengajuanJudul.length > 0 ? mhs.pengajuanJudul[0] : null;
            const penilaian = mhs.penilaian && mhs.penilaian.length > 0 ? mhs.penilaian[0] : null;
            
            return {
                mahasiswaId: mhs.id,
                nama: mhs.nama,
                nim: mhs.nim,
                jurusan: mhs.jurusan,
                judulSkripsi: s.judul || (p ? p.judul : "-"),
                penilaianId: penilaian ? penilaian.id : null,
                
                // Detailed Components
                p1_k1: penilaian ? penilaian.p1_k1 : null,
                p1_k2: penilaian ? penilaian.p1_k2 : null,
                p1_k3: penilaian ? penilaian.p1_k3 : null,
                p1_total: penilaian ? penilaian.p1_total : null,
                p1_nama: penilaian ? penilaian.p1_nama : null,

                p2_k1: penilaian ? penilaian.p2_k1 : null,
                p2_k2: penilaian ? penilaian.p2_k2 : null,
                p2_k3: penilaian ? penilaian.p2_k3 : null,
                p2_total: penilaian ? penilaian.p2_total : null,
                p2_nama: penilaian ? penilaian.p2_nama : null,

                nilai: penilaian ? penilaian.nilaiRataRata : null, // Alias for legacy or simple display
                nilaiRataRata: penilaian ? penilaian.nilaiRataRata : null,
                keterangan: penilaian ? penilaian.keterangan : null,
                tanggal: penilaian ? penilaian.tanggal : null,
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Get Penilaian by Dosen Error:", error);
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

        // Check if already graded
        const existing = await prisma.penilaian.findFirst({
            where: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: dosen.id
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
                dosenId: dosen.id,
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

module.exports = {
    getAllPenilaian,
    getPenilaianByMahasiswa,
    getPenilaianByDosen,
    createPenilaian,
    updatePenilaian,
    deletePenilaian
};
