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

const getDosenBimbinganStudents = async (req, res) => {
    try {
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        // Fetch pengajuan that are APPROVED for this dosen
        const pengajuanList = await prisma.pengajuanJudul.findMany({
            where: { 
                dosenId: dosen.id,
                status: 'APPROVED'
            },
            include: {
                mahasiswa: {
                    include: {
                        bimbingan: {
                            orderBy: { tanggal: 'desc' },
                        }
                    }
                }
            }
        });

        res.json(pengajuanList);
    } catch (error) {
        console.error("Get Dosen Bimbingan Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getLaporanAkhirDosen = async (req, res) => {
    try {
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        // Get all unique students supervised by this dosen via Bimbingan
        const bimbinganList = await prisma.bimbingan.findMany({
            where: { dosenId: dosen.id },
            include: {
                mahasiswa: {
                    include: {
                        pengajuanJudul: { where: { dosenId: dosen.id } },
                        penilaian: { where: { dosenId: dosen.id } }
                    }
                }
            }
        });

        const mahasiswaMap = new Map();
        bimbinganList.forEach(b => {
            if (!mahasiswaMap.has(b.mahasiswaId)) {
                mahasiswaMap.set(b.mahasiswaId, {
                    mahasiswa: b.mahasiswa,
                    bimbingan: [],
                    penilaian: b.mahasiswa.penilaian
                });
            }
            mahasiswaMap.get(b.mahasiswaId).bimbingan.push(b);
        });

        const laporan = Array.from(mahasiswaMap.values()).map(item => {
            const mhs = item.mahasiswa;
            const bimbinganList = item.bimbingan;
            const bimbinganApproved = bimbinganList.filter(b => b.status === 'APPROVED');
            
            const latestBimbingan = bimbinganList.length > 0 
                ? bimbinganList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))[0] 
                : null;
            
            let statusProgress = "Belum Mulai";
            if (latestBimbingan) {
                if (latestBimbingan.status === 'APPROVED') statusProgress = "Revisi Diterima";
                else if (latestBimbingan.status === 'REVISION') statusProgress = "Revisi Bimbingan";
                else if (latestBimbingan.status === 'SUBMITTED') statusProgress = "Menunggu Reviu";
                else if (latestBimbingan.status === 'ASSIGNED') statusProgress = "Bimbingan Aktif";
            }

            const penilaian = item.penilaian && item.penilaian.length > 0 ? item.penilaian[0] : null;
            if (penilaian) {
                statusProgress = "Selesai (Sudah Dinilai)";
            }

            const pengajuan = mhs.pengajuanJudul && mhs.pengajuanJudul.length > 0 ? mhs.pengajuanJudul[0] : null;

            return {
                id: mhs.id,
                nama: mhs.nama,
                nim: mhs.nim,
                judulSkripsi: pengajuan ? (pengajuan.judul || latestBimbingan?.topik || "-") : (latestBimbingan ? latestBimbingan.topik : "-"),
                totalBimbinganSelesai: bimbinganApproved.length,
                totalBimbingan: bimbinganList.length,
                nilaiAkhir: penilaian ? penilaian.nilai : null,
                keteranganPenilaian: penilaian ? penilaian.keterangan : null,
                statusProgress
            };
        });

        res.json(laporan);
    } catch (error) {
        console.error("Get Laporan Akhir Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const assignBimbinganTask = async (req, res) => {
    try {
        const { mahasiswaId, topik, jadwalBimbingan } = req.body;
        
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        const newBimbingan = await prisma.bimbingan.create({
            data: {
                mahasiswaId: parseInt(mahasiswaId),
                dosenId: dosen.id,
                topik,
                catatan: "Task Assigned",
                status: "ASSIGNED",
                jadwalBimbingan: jadwalBimbingan ? new Date(jadwalBimbingan) : null,
                versi: 1
            }
        });

        res.status(201).json(newBimbingan);
    } catch (error) {
        console.error("Assign Task Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateBimbinganTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { topik, jadwalBimbingan } = req.body;
        
        const bimbinganInfo = await prisma.bimbingan.findUnique({
            where: { id: parseInt(id) },
        });

        if (!bimbinganInfo) {
            return res.status(404).json({ message: "Bimbingan not found" });
        }

        const bimbingan = await prisma.bimbingan.update({
            where: { id: parseInt(id) },
            data: {
                topik,
                jadwalBimbingan: jadwalBimbingan ? new Date(jadwalBimbingan) : null
            }
        });

        res.json(bimbingan);
    } catch (error) {
        console.error("Update Task Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getMahasiswaActiveTask = async (req, res) => {
    try {
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) {
            return res.status(404).json({ message: "Mahasiswa profile not found" });
        }

        const task = await prisma.bimbingan.findFirst({
            where: { mahasiswaId: mahasiswa.id },
            orderBy: { id: 'desc' }
        });

        res.json(task);
    } catch (error) {
        console.error("Get Active Task Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getMahasiswaAllTasks = async (req, res) => {
    try {
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) {
            return res.status(404).json({ message: "Mahasiswa profile not found" });
        }

        const tasks = await prisma.bimbingan.findMany({
            where: { mahasiswaId: mahasiswa.id },
            orderBy: { id: 'desc' },
            include: { anotasi: true }
        });

        res.json(tasks);
    } catch (error) {
        console.error("Get All Tasks Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const uploadDraftMahasiswa = async (req, res) => {
    try {
        const { id } = req.params; // Bimbingan ID
        const file = req.file;
        const { keteranganProgres } = req.body;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const bimbinganInfo = await prisma.bimbingan.findUnique({
            where: { id: parseInt(id) },
        });

        if (!bimbinganInfo) {
            return res.status(404).json({ message: "Bimbingan not found" });
        }

        if (bimbinganInfo.status === 'REVISION') {
            const newBimbingan = await prisma.bimbingan.create({
                data: {
                    mahasiswaId: bimbinganInfo.mahasiswaId,
                    dosenId: bimbinganInfo.dosenId,
                    topik: bimbinganInfo.topik,
                    status: 'SUBMITTED',
                    fileMahasiswa: `/uploads/bimbingan/${file.filename}`,
                    keteranganProgres: keteranganProgres || null,
                    jadwalBimbingan: bimbinganInfo.jadwalBimbingan,
                    versi: bimbinganInfo.versi + 1,
                    parentId: bimbinganInfo.id,
                    catatan: "Menunggu Reviu Dosen"
                }
            });
            return res.json(newBimbingan);
        } else {
            const bimbingan = await prisma.bimbingan.update({
                where: { id: parseInt(id) },
                data: {
                    fileMahasiswa: `/uploads/bimbingan/${file.filename}`,
                    keteranganProgres: keteranganProgres || null,
                    status: 'SUBMITTED'
                }
            });
            return res.json(bimbingan);
        }
    } catch (error) {
        console.error("Upload Draft Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const bimbingan = await prisma.bimbingan.update({
            where: { id: parseInt(id) },
            data: { isReadDosen: true }
        });
        res.json(bimbingan);
    } catch (error) {
        console.error("Mark As Read Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const uploadRevisiDosen = async (req, res) => {
    try {
        const { id } = req.params; // Bimbingan ID
        const { status, catatan } = req.body;
        const file = req.file;

        const bimbinganInfo = await prisma.bimbingan.findUnique({
            where: { id: parseInt(id) },
        });

        if (!bimbinganInfo) {
            return res.status(404).json({ message: "Bimbingan not found" });
        }

        const updateData = {
            status: status || 'REVISION',
            catatan: catatan || bimbinganInfo.catatan
        };

        if (file) {
            updateData.fileDosen = `/uploads/bimbingan/${file.filename}`;
        }

        const bimbingan = await prisma.bimbingan.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json(bimbingan);
    } catch (error) {
        console.error("Upload Revisi Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getBimbinganHistory = async (req, res) => {
    try {
        const { mahasiswaId, topik } = req.params;
        const decodedTopik = decodeURIComponent(topik);

        const history = await prisma.bimbingan.findMany({
            where: {
                mahasiswaId: parseInt(mahasiswaId),
                topik: decodedTopik
            },
            orderBy: { versi: 'asc' },
            include: { anotasi: true }
        });

        res.json(history);
    } catch (error) {
        console.error("Get History Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const createAnnotation = async (req, res) => {
    try {
        const { bimbinganId, komentar, warna, posisi } = req.body;
        const annotation = await prisma.bimbinganAnnotation.create({
            data: {
                bimbinganId: parseInt(bimbinganId),
                komentar,
                warna: warna || "#FFFF00",
                posisi
            }
        });
        res.status(201).json(annotation);
    } catch (error) {
        console.error("Create Annotation Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getAnnotations = async (req, res) => {
    try {
        const { bimbinganId } = req.params;
        const annotations = await prisma.bimbinganAnnotation.findMany({
            where: { bimbinganId: parseInt(bimbinganId) }
        });
        res.json(annotations);
    } catch (error) {
        console.error("Get Annotations Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteAnnotation = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.bimbinganAnnotation.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Annotation deleted successfully" });
    } catch (error) {
        console.error("Delete Annotation Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getAllProdiBimbingan = async (req, res) => {
    try {
        const dosens = await prisma.dosen.findMany({
            include: {
                pengajuanJudul: {
                    where: { status: 'APPROVED' },
                    include: {
                        mahasiswa: {
                            include: {
                                bimbingan: {
                                    orderBy: { tanggal: 'desc' },
                                    take: 1
                                }
                            }
                        }
                    }
                }
            }
        });

        const result = dosens.map(d => {
            const students = d.pengajuanJudul.map(p => ({
                id: p.id,
                mahasiswa: p.mahasiswa,
                status: p.status
            }));

            // Mock progress calculation or use real if available
            const progressSum = students.length > 0 ? 50 : 0; // Placeholder

            return {
                dosen: {
                    id: d.id,
                    nama: d.nama,
                    username: d.username,
                    photo: d.photo
                },
                students: students,
                totalStudents: students.length,
                activeProgress: progressSum
            };
        });

        res.json(result);
    } catch (error) {
        console.error("Get All Prodi Bimbingan Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllBimbingan,
    getBimbinganByMahasiswa,
    createBimbingan,
    getDosenBimbinganStudents,
    getLaporanAkhirDosen,
    assignBimbinganTask,
    updateBimbinganTask,
    getMahasiswaActiveTask,
    getMahasiswaAllTasks,
    uploadDraftMahasiswa,
    uploadRevisiDosen,
    getBimbinganHistory,
    createAnnotation,
    getAnnotations,
    deleteAnnotation,
    markAsRead,
    getAllProdiBimbingan
};
