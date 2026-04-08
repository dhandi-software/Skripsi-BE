const prisma = require('../prisma');

/**
 * @api {get} /acara Get all Acara posts
 * @apiDescription Mendapatkan semua daftar Berita Acara/Tugas. 
 * Jika diakses oleh Mahasiswa, akan menyertakan status 'isRead'.
 */
const getAcara = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role?.toUpperCase();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Fetch mahasiswa profile if student to get their internal ID
        let mahasiswa = null;
        let readAcaraIds = new Set();
        
        if (role === 'MAHASISWA') {
            mahasiswa = await prisma.mahasiswa.findFirst({
                where: { userId: parseInt(userId) }
            });

            if (mahasiswa) {
                // Fetch all IDs this student has read
                const readStatuses = await prisma.acaraReadStatus.findMany({
                    where: { mahasiswaId: mahasiswa.id },
                    select: { acaraId: true }
                });
                readAcaraIds = new Set(readStatuses.map(rs => rs.acaraId));
            }
        }

        const [acara, total] = await Promise.all([
            prisma.acara.findMany({
                skip,
                take: limit,
                include: {
                    dosen: true,
                    comments: {
                        include: {
                            user: {
                                select: {
                                    username: true,
                                    role: true,
                                    id: true,
                                    mahasiswa: { select: { nama: true } },
                                    dosen: { select: { nama: true } }
                                }
                            }
                        },
                        orderBy: {
                            createdAt: 'asc'
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.acara.count()
        ]);

        // Transform results for student to have a simple isReadByMe boolean
        const data = acara.map(item => {
            const isReadByMe = role === 'MAHASISWA' ? readAcaraIds.has(item.id) : true;
            return { ...item, isReadByMe };
        });

        res.json({
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get Acara Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const createAcara = async (req, res) => {
    try {
        const { title, content, type } = req.body;
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

        const acara = await prisma.acara.create({
            data: {
                title,
                content,
                type: type || "ASSIGNMENT",
                dosenId: dosen.id
            }
        });
        res.status(201).json(acara);
    } catch (error) {
        console.error("Create Acara Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateAcara = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, type } = req.body;
        
        const acara = await prisma.acara.update({
            where: { id: parseInt(id) },
            data: { title, content, type }
        });
        res.json(acara);
    } catch (error) {
        console.error("Update Acara Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteAcara = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.acara.delete({ where: { id: parseInt(id) } });
        res.json({ message: "Acara berhasil dihapus." });
    } catch (error) {
        console.error("Delete Acara Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        const comment = await prisma.acaraComment.create({
            data: {
                content,
                acaraId: parseInt(id),
                userId: req.user.id
            },
            include: {
                user: {
                    select: {
                        username: true,
                        role: true,
                        id: true,
                        mahasiswa: { select: { nama: true } },
                        dosen: { select: { nama: true } }
                    }
                }
            }
        });
        res.status(201).json(comment);
    } catch (error) {
        console.error("Add Comment Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        
        // Return relative path for static serving
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ 
            url: fileUrl,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error("Upload File Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * @api {get} /acara/unread-count Get unread Acara count for student
 * @apiDescription Menghitung jumlah Berita Acara yang belum dibaca oleh mahasiswa yang sedang login.
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role?.toUpperCase();

        if (role !== 'MAHASISWA') return res.json({ count: 0 });

        const mahasiswa = await prisma.mahasiswa.findFirst({
            where: { userId: parseInt(userId) }
        });

        if (!mahasiswa) return res.json({ count: 0 });

        // Count all Acara that don't have a read status for this mahasiswa
        const allAcaraCount = await prisma.acara.count();
        const readAcaraCount = await prisma.acaraReadStatus.count({
            where: { mahasiswaId: mahasiswa.id }
        });

        res.json({ count: Math.max(0, allAcaraCount - readAcaraCount) });
    } catch (error) {
        console.error("Get Unread Count Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * @api {post} /acara/:id/read Mark Acara as read
 * @apiDescription Menandai sebuah Berita Acara sebagai 'sudah dibaca' oleh mahasiswa.
 */
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const mahasiswa = await prisma.mahasiswa.findFirst({
            where: { userId: parseInt(userId) }
        });

        if (!mahasiswa) return res.status(404).json({ message: "Mahasiswa profile not found" });

        await prisma.acaraReadStatus.upsert({
            where: {
                acaraId_mahasiswaId: {
                    acaraId: parseInt(id),
                    mahasiswaId: mahasiswa.id
                }
            },
            update: {},
            create: {
                acaraId: parseInt(id),
                mahasiswaId: mahasiswa.id
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Mark Read Error:", error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAcara,
    createAcara,
    updateAcara,
    deleteAcara,
    addComment,
    uploadFile,
    getUnreadCount,
    markAsRead
};
