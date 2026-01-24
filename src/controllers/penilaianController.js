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

const createPenilaian = async (req, res) => {
    const { mahasiswaId, dosenId, nilai, keterangan } = req.body;
    try {
        const newPenilaian = await prisma.penilaian.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: parseInt(dosenId),
                nilai: parseFloat(nilai),
                keterangan,
            }
        });
        res.status(201).json(newPenilaian);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllPenilaian,
    getPenilaianByMahasiswa,
    createPenilaian
};
