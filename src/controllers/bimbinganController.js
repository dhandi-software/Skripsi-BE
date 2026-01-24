const prisma = require('../prisma');

const getAllBimbingan = async (req, res) => {
    try {
        const bimbingan = await prisma.bimbingan.findMany({
            include: {
                mahasiswa: true,
                dosen: true
            }
        });
        res.json(bimbingan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getBimbinganByMahasiswa = async (req, res) => {
    const { mahasiswaId } = req.params;
    try {
        const bimbingan = await prisma.bimbingan.findMany({
            where: { mahasiswaId: parseInt(mahasiswaId) },
            include: { dosen: true }
        });
        res.json(bimbingan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createBimbingan = async (req, res) => {
    const { mahasiswaId, dosenId, topik, catatan, status } = req.body;
    try {
        const newBimbingan = await prisma.bimbingan.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: parseInt(dosenId),
                topik,
                catatan,
                status: status || 'PENDING'
            }
        });
        res.status(201).json(newBimbingan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllBimbingan,
    getBimbinganByMahasiswa,
    createBimbingan
};
