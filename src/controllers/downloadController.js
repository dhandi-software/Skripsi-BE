const prisma = require('../prisma');

/**
 * @api {get} /download Get all Download materials
 */
const getDownloads = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [downloads, total] = await Promise.all([
            prisma.download.findMany({
                skip,
                take: limit,
                include: {
                    dosen: {
                        select: {
                            nama: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.download.count()
        ]);

        res.json({
            data: downloads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Get Downloads Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const getDownloadById = async (req, res) => {
    try {
        const { id } = req.params;
        const download = await prisma.download.findUnique({
            where: { id: parseInt(id) },
            include: {
                dosen: {
                    select: {
                        nama: true
                    }
                }
            }
        });

        if (!download) return res.status(404).json({ message: "File tidak ditemukan" });
        
        res.json(download);
    } catch (error) {
        console.error("Get Download By ID Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const createDownload = async (req, res) => {
    try {
        const { title, description, fileUrl, fileType } = req.body;
        const dosen = await prisma.dosen.findUnique({
            where: { userId: parseInt(req.user.id) }
        });

        if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

        const download = await prisma.download.create({
            data: {
                title,
                fileUrl,
                fileType,
                dosenId: dosen.id
            }
        });

        res.status(201).json(download);
    } catch (error) {
        console.error("Create Download Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateDownload = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, fileUrl, fileType } = req.body;
        
        const download = await prisma.download.update({
            where: { id: parseInt(id) },
            data: { title, fileUrl, fileType }
        });
        res.json(download);
    } catch (error) {
        console.error("Update Download Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const deleteDownload = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.download.delete({ where: { id: parseInt(id) } });
        res.json({ message: "File berhasil dihapus." });
    } catch (error) {
        console.error("Delete Download Error:", error);
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

module.exports = {
    getDownloads,
    getDownloadById,
    createDownload,
    updateDownload,
    deleteDownload,
    uploadFile,
    downloadFile: async (req, res) => {
        try {
            const { id } = req.params;
            const download = await prisma.download.findUnique({
                where: { id: parseInt(id) }
            });

            if (!download) return res.status(404).json({ message: "File tidak ditemukan" });

            const path = require('path');
            const fs = require('fs');
            
            // Resolve path (fileUrl starts with /uploads/)
            const filePath = path.join(__dirname, '../../', download.fileUrl);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: "File fisik tidak ditemukan" });
            }

            // Set clean filename with original extension
            const ext = path.extname(download.fileUrl);
            const titleWithoutExt = download.title.replace(ext, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const safeName = `${titleWithoutExt}${ext}`;

            res.download(filePath, safeName);
        } catch (error) {
            console.error("Download Error:", error);
            res.status(500).json({ error: error.message });
        }
    }
};
