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
            where: { mahasiswaNim: mahasiswaId },
            include: { dosen: true },
            orderBy: { id: 'desc' }
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
                mahasiswaNim: mahasiswaId,
                dosenNidn: dosenId,
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
        const { search, status } = req.query;

        // Build base query
        const whereClause = { status: 'APPROVED' };

        if (req.user.role.toUpperCase() !== 'STAF') {
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });
            if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });
            whereClause.dosenNidn = dosen.nidn;
        }

        // Add Search functionality natively to Prisma query
        if (search) {
            whereClause.mahasiswa = {
                OR: [
                    { nama: { contains: search, mode: 'insensitive' } },
                    { nim: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        let pengajuanList = await prisma.pengajuanJudul.findMany({
            where: whereClause,
            include: {
                dosen: req.user.role.toUpperCase() === 'STAF', // Only include dosen if STAF
                mahasiswa: {
                    include: {
                        bimbingan: {
                            orderBy: { tanggal: 'desc' },
                        }
                    }
                }
            }
        });

        // Backend Status Filtering
        if (status && status !== "Semua") {
            pengajuanList = pengajuanList.filter(item => {
                const activeTask = item.mahasiswa?.bimbingan?.[0];
                const noActiveTarget = !activeTask || activeTask.status === 'APPROVED';

                if (status === "Belum Ditargetkan") return noActiveTarget;
                if (status === "Perlu Revisi") return activeTask?.status === 'REVISION';
                if (status === "Menunggu Reviu") return activeTask?.status === 'SUBMITTED';
                if (status === "Sedang Dikerjakan") return activeTask?.status === 'ASSIGNED';
                return true;
            });
        }

        // Priority Sorting Logic
        pengajuanList.sort((a, b) => {
            const aTask = a.mahasiswa?.bimbingan?.[0];
            const bTask = b.mahasiswa?.bimbingan?.[0];

            const getPriority = (task) => {
                if (!task || task.status === 'APPROVED') return 1; // Priority 1: Belum ditargetkan
                if (task.status === 'SUBMITTED') return 2; // Priority 2: Menunggu Reviu Dosen
                if (task.status === 'REVISION') return 3; // Priority 3: Perlu Revisi Mahasiswa
                if (task.status === 'ASSIGNED') return 4; // Priority 4: Sedang Dikerjakan Mahasiswa
                return 5;
            };

            const pA = getPriority(aTask);
            const pB = getPriority(bTask);

            if (pA !== pB) return pA - pB;

            // Secondary sort: Latest approved PengajuanJudul (tanggal)
            const dateA = new Date(a.tanggal || 0).getTime();
            const dateB = new Date(b.tanggal || 0).getTime();
            return dateB - dateA; // Descending order (newest first)
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

        // Get all unique students supervised by this dosen via approved title proposals
        const pengajuanList = await prisma.pengajuanJudul.findMany({
            where: {
                dosenNidn: dosen.nidn,
                status: 'APPROVED'
            },
            include: {
                mahasiswa: {
                    include: {
                        pengajuanJudul: { where: { dosenNidn: dosen.nidn } },
                        penilaian: { where: { dosenNidn: dosen.nidn } },
                        bimbingan: { where: { dosenNidn: dosen.nidn } },
                        logbook: true,
                        tempatKP: true
                    }
                }
            }
        });

        const mahasiswaMap = new Map();
        pengajuanList.forEach(p => {
            const mhs = p.mahasiswa;
            if (!mhs) return;
            if (!mahasiswaMap.has(mhs.nim)) {
                mahasiswaMap.set(mhs.nim, {
                    mahasiswa: mhs,
                    bimbingan: mhs.bimbingan || [],
                    penilaian: mhs.penilaian || []
                });
            }
        });

        const laporan = Array.from(mahasiswaMap.values()).map(item => {
            const mhs = item.mahasiswa;
            const bimbinganList = item.bimbingan;
            const uniqueTopics = Array.from(new Set(bimbinganList.map(b => b.topik.trim().toLowerCase()).filter(Boolean)));
            const approvedTopicsCount = uniqueTopics.filter(topic =>
                bimbinganList.some(b => b.topik.trim().toLowerCase() === topic && b.status === 'APPROVED')
            ).length;

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
            const logbooks = mhs.logbook || [];
            const logbooksApproved = logbooks.filter(l => l.pembimbingParaf !== null && l.pembimbingParaf !== "");

            return {
                id: mhs.nim,
                nama: mhs.nama,
                nim: mhs.nim,
                judulSkripsi: pengajuan ? (pengajuan.judul || latestBimbingan?.topik || "-") : (latestBimbingan ? latestBimbingan.topik : "-"),
                totalBimbinganSelesai: approvedTopicsCount,
                totalBimbingan: uniqueTopics.length,
                totalLogbook: logbooks.length,
                totalLogbookApproved: logbooksApproved.length,
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
                nilaiAkhir: penilaian ? penilaian.nilaiRataRata : null,
                keteranganPenilaian: penilaian ? penilaian.keterangan : null,
                statusProgress,
                tempatKP: mhs.tempatKP || null,
                logbooks: logbooks,
                bimbingans: bimbinganList
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
                mahasiswaNim: mahasiswaId,
                dosenNidn: dosen.nidn,
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
            where: { mahasiswaNim: mahasiswa.nim },
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
            where: { mahasiswaNim: mahasiswa.nim },
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
                    mahasiswaNim: bimbinganInfo.mahasiswaNim,
                    dosenNidn: bimbinganInfo.dosenNidn,
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
                mahasiswaNim: mahasiswaId,
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

const getPreviousAnnotations = async (req, res) => {
    try {
        const { bimbinganId } = req.params;

        // Find current bimbingan to get its parent chain or topic info
        const currentBimbingan = await prisma.bimbingan.findUnique({
            where: { id: parseInt(bimbinganId) }
        });

        if (!currentBimbingan) {
            return res.status(404).json({ message: "Bimbingan not found" });
        }

        // Get all annotations from older versions of the same topic
        const previousBimbingans = await prisma.bimbingan.findMany({
            where: {
                mahasiswaNim: currentBimbingan.mahasiswaNim,
                topik: currentBimbingan.topik,
                id: { lt: currentBimbingan.id }, // Only get older ones
                fileMahasiswa: { not: null } // Only those that had files
            },
            include: { anotasi: true },
            orderBy: { versi: 'desc' }
        });

        // Flatten all annotations into a single array
        let allPreviousAnnotations = [];
        previousBimbingans.forEach(b => {
            if (b.anotasi && b.anotasi.length > 0) {
                // Add version info to each annotation for context
                const annotsWithVersion = b.anotasi.map(a => ({
                    ...a,
                    bimbinganVersi: b.versi,
                    tanggalBimbingan: b.tanggal
                }));
                allPreviousAnnotations = [...allPreviousAnnotations, ...annotsWithVersion];
            }
        });

        // Sort from newest to oldest
        allPreviousAnnotations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(allPreviousAnnotations);
    } catch (error) {
        console.error("Get Previous Annotations Error:", error);
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
            where: {
                OR: [
                    { jabatan: { contains: 'Pembimbing', mode: 'insensitive' } },
                    { jabatan: { contains: 'Koordinator', mode: 'insensitive' } }
                ]
            },
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
                    photo: d.dosen?.photo || null
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
    getPreviousAnnotations,
    deleteAnnotation,
    markAsRead,
    getAllProdiBimbingan
};
