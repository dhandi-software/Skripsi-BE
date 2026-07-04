const prisma = require('../prisma');

const getAllJadwalKp = async (req, res) => {
    try {
        const jadwal = await prisma.jadwalKp.findMany({
            include: {
                staf: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(jadwal);
    } catch (error) {
        console.error("Get All JadwalKp Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getActiveJadwalKp = async (req, res) => {
    try {
        const { tipe } = req.query; // PENGARAHAN_KP or PENGAJUAN_SIDANG
        const now = new Date();

        const whereClause = {
            tanggal: { gte: now }
        };

        if (tipe) {
            whereClause.tipe = tipe;
        }

        const jadwal = await prisma.jadwalKp.findFirst({
            where: whereClause,
            orderBy: {
                tanggal: 'asc' // Find the one happening soonest
            }
        });

        res.json(jadwal);
    } catch (error) {
        console.error("Get Active JadwalKp Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const createJadwalKp = async (req, res) => {
    try {
        const { tipe, judul, deskripsi, tanggal, waktu } = req.body;
        
        const staf = await prisma.staf.findUnique({
            where: { userId: req.user.id }
        });

        if (!staf) {
            return res.status(403).json({ message: "Only staf can create jadwal KP" });
        }

        // Combine tanggal and waktu into a single Date object
        // Assuming format is YYYY-MM-DD and HH:mm
        const finalDate = new Date(`${tanggal}T${waktu}:00`);

        const newJadwal = await prisma.jadwalKp.create({
            data: {
                tipe,
                judul,
                deskripsi,
                tanggal: finalDate,
                stafNip: staf.nip
            }
        });

        res.status(201).json(newJadwal);
    } catch (error) {
        console.error("Create JadwalKp Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateJadwalKp = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipe, judul, deskripsi, tanggal, waktu } = req.body;

        const finalDate = new Date(`${tanggal}T${waktu}:00`);

        const updatedJadwal = await prisma.jadwalKp.update({
            where: { id: parseInt(id) },
            data: {
                tipe,
                judul,
                deskripsi,
                tanggal: finalDate
            }
        });

        res.json(updatedJadwal);
    } catch (error) {
        console.error("Update JadwalKp Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteJadwalKp = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.jadwalKp.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: "JadwalKp deleted successfully" });
    } catch (error) {
        console.error("Delete JadwalKp Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllJadwalKp,
    getActiveJadwalKp,
    createJadwalKp,
    updateJadwalKp,
    deleteJadwalKp
};

