const prisma = require('../prisma');

const syncSanksiStatus = async (list) => {
    const now = new Date();
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item.status === 'Menunggu Hardcover' && item.tenggatWaktu) {
            if (now > item.tenggatWaktu) {
                await prisma.sanksiAdministrasi.update({
                    where: { id: item.id },
                    data: { status: 'Terlambat' }
                });
                item.status = 'Terlambat';
            }
        }
    }
    return list;
};

const getAllSanksi = async (req, res) => {
    try {
        const role = req.user.role.toUpperCase();
        if (role === 'MAHASISWA') {
            const student = await prisma.mahasiswa.findUnique({
                where: { userId: req.user.id }
            });
            if (!student) return res.status(404).json({ message: "Student profile not found" });
            const list = await prisma.sanksiAdministrasi.findMany({
                where: { mahasiswaNim: student.nim },
                include: { dosen: true }
            });
            const syncedList = await syncSanksiStatus(list);
            return res.json(syncedList);
        } else {
            // DOSEN, KAPRODI, STAF, ADMIN
            const list = await prisma.sanksiAdministrasi.findMany({
                include: { mahasiswa: true, dosen: true },
                orderBy: { createdAt: 'desc' }
            });
            const syncedList = await syncSanksiStatus(list);
            return res.json(syncedList);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getSupervisedStudents = async (req, res) => {
    try {
        const role = req.user.role.toUpperCase();
        // Ambil semua mahasiswa
        const list = await prisma.mahasiswa.findMany({
            include: {
                sidang: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { nama: 'asc' }
        });

        const existingSanksi = await prisma.sanksiAdministrasi.findMany({
            select: { mahasiswaNim: true }
        });
        const hasSanksiSet = new Set(existingSanksi.map(s => s.mahasiswaNim));

        const students = [];
        const seen = new Set();
        for (const item of list) {
            if (!hasSanksiSet.has(item.nim)) {
                const statusSidang = item.sidang && item.sidang.length > 0 ? item.sidang[0].status : null;
                const tanggalSidang = item.sidang && item.sidang.length > 0 ? item.sidang[0].tanggalSidang : null;
                
                if (statusSidang === 'TERJADWAL' && tanggalSidang) {
                    students.push({
                        id: item.nim,
                        nama: item.nama,
                        nim: item.nim,
                        tanggalSidang: tanggalSidang,
                        statusSidang: statusSidang
                    });
                }
            }
        }

        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createSanksi = async (req, res) => {
    const { mahasiswaId, nama, nim, hariSidang, tanggalSidang, hariTenggat, tanggalSurat } = req.body;
    try {
        let tenggatWaktu = null;
        if (tanggalSidang) {
            const parsed = new Date(tanggalSidang);
            if (!isNaN(parsed.getTime())) {
                parsed.setDate(parsed.getDate() + 7);
                tenggatWaktu = parsed;
            }
        }

        const existingSanksi = await prisma.sanksiAdministrasi.findFirst({
            where: { mahasiswaNim: mahasiswaId }
        });

        if (existingSanksi) {
            return res.status(400).json({ error: "Mahasiswa ini sudah memiliki sanksi administrasi." });
        }
        
        let dosenId = null;

        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (dosen) {
            dosenId = dosen.nidn;
        } else {
            const approvedJudul = await prisma.pengajuanJudul.findFirst({
                where: { mahasiswaNim: mahasiswaId, status: 'APPROVED' }
            });
            if (approvedJudul) {
                dosenId = approvedJudul.dosenNidn;
            } else {
                const firstDosen = await prisma.dosen.findFirst();
                if (!firstDosen) return res.status(400).json({ message: "No Dosen found in system" });
                dosenId = firstDosen.nidn;
            }
        }

        const newSanksi = await prisma.sanksiAdministrasi.create({
            data: {
                mahasiswaNim: mahasiswaId,
                dosenNidn: dosenId,
                nama,
                nim,
                hariSidang,
                tanggalSidang,
                hariTenggat,
                tanggalSurat,
                tenggatWaktu,
                status: 'Menunggu Hardcover'
            }
        });

        res.status(201).json(newSanksi);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateSanksi = async (req, res) => {
    const { id } = req.params;
    const { nama, nim, hariSidang, tanggalSidang, hariTenggat, tanggalSurat } = req.body;
    try {
        const updatedSanksi = await prisma.sanksiAdministrasi.update({
            where: { id: parseInt(id) },
            data: {
                nama,
                nim,
                hariSidang,
                tanggalSidang,
                hariTenggat,
                tanggalSurat
            }
        });
        res.json(updatedSanksi);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteSanksi = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.sanksiAdministrasi.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "Sanksi Administrasi deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const terimaHardcover = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedSanksi = await prisma.sanksiAdministrasi.update({
            where: { id: parseInt(id) },
            data: { status: 'Selesai/Lunas' }
        });
        res.json(updatedSanksi);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllSanksi,
    getSupervisedStudents,
    createSanksi,
    updateSanksi,
    deleteSanksi,
    terimaHardcover
};
