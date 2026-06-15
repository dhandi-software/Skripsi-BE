const prisma = require('../prisma');

const getAllSanksi = async (req, res) => {
    try {
        const role = req.user.role.toUpperCase();
        if (role === 'MAHASISWA') {
            const student = await prisma.mahasiswa.findUnique({
                where: { userId: req.user.id }
            });
            if (!student) return res.status(404).json({ message: "Student profile not found" });
            const list = await prisma.sanksiAdministrasi.findMany({
                where: { mahasiswaId: student.id },
                include: { dosen: true }
            });
            return res.json(list);
        } else {
            // DOSEN, KAPRODI, STAF, ADMIN
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            
            const isKoordinator = !dosen || (dosen.jabatan && (
                dosen.jabatan.includes('Pejabat Prodi') || 
                dosen.jabatan.includes('Koordinator KP') || 
                dosen.jabatan.toLowerCase().includes('koordinator')
            )) || role === 'ADMIN' || role === 'STAF' || role === 'KAPRODI';

            let list;
            if (isKoordinator) {
                list = await prisma.sanksiAdministrasi.findMany({
                    include: { mahasiswa: true, dosen: true }
                });
            } else {
                list = await prisma.sanksiAdministrasi.findMany({
                    where: { dosenId: dosen.id },
                    include: { mahasiswa: true, dosen: true }
                });
            }
            return res.json(list);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getSupervisedStudents = async (req, res) => {
    try {
        const role = req.user.role.toUpperCase();
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        const isKoordinator = !dosen || (dosen.jabatan && (
            dosen.jabatan.includes('Pejabat Prodi') || 
            dosen.jabatan.includes('Koordinator KP') || 
            dosen.jabatan.toLowerCase().includes('koordinator')
        )) || role === 'ADMIN' || role === 'STAF' || role === 'KAPRODI';

        let list;
        if (isKoordinator) {
            list = await prisma.pengajuanJudul.findMany({
                where: { status: 'APPROVED' },
                include: { mahasiswa: true }
            });
        } else {
            list = await prisma.pengajuanJudul.findMany({
                where: {
                    status: 'APPROVED',
                    dosenId: dosen.id
                },
                include: { mahasiswa: true }
            });
        }

        const students = [];
        const seen = new Set();
        for (const item of list) {
            if (item.mahasiswa && !seen.has(item.mahasiswa.id)) {
                seen.add(item.mahasiswa.id);
                students.push({
                    id: item.mahasiswa.id,
                    nama: item.mahasiswa.nama,
                    nim: item.mahasiswa.nim,
                    jurusan: item.mahasiswa.jurusan
                });
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
        let dosenId = null;

        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (dosen) {
            dosenId = dosen.id;
        } else {
            const approvedJudul = await prisma.pengajuanJudul.findFirst({
                where: { mahasiswaId: parseInt(mahasiswaId), status: 'APPROVED' }
            });
            if (approvedJudul) {
                dosenId = approvedJudul.dosenId;
            } else {
                const firstDosen = await prisma.dosen.findFirst();
                if (!firstDosen) return res.status(400).json({ message: "No Dosen found in system" });
                dosenId = firstDosen.id;
            }
        }

        const newSanksi = await prisma.sanksiAdministrasi.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: dosenId,
                nama,
                nim,
                hariSidang,
                tanggalSidang,
                hariTenggat,
                tanggalSurat
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

module.exports = {
    getAllSanksi,
    getSupervisedStudents,
    createSanksi,
    updateSanksi,
    deleteSanksi
};
