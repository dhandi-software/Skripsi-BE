const prisma = require('../prisma');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
                    },
                    user: {
                        select: {
                            username: true,
                            role: true,
                            id: true,
                            
                            mahasiswa: { select: { nama: true, photo: true } },
                            dosen: { select: { nama: true, photo: true } }
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
                },
                user: {
                    select: {
                        username: true,
                        role: true,
                        id: true,
                        
                        mahasiswa: { select: { nama: true, photo: true } },
                        dosen: { select: { nama: true, photo: true } }
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
        if (!title || !title.trim()) {
            return res.status(400).json({ message: "Judul materi wajib diisi" });
        }
        if (title.trim().length > 150) {
            return res.status(400).json({ message: "Judul materi maksimal 150 karakter" });
        }

        let dosen = await prisma.dosen.findUnique({
            where: { userId: parseInt(req.user.id) }
        });

        if (!dosen && (req.user.role.toUpperCase() === 'ADMIN' || req.user.role.toUpperCase() === 'STAF')) {
            dosen = await prisma.dosen.findFirst();
        }

        if (!dosen) return res.status(404).json({ message: "Dosen profile not found" });

        const download = await prisma.download.create({
            data: {
                title: title.trim(),
                description,
                fileUrl,
                fileType,
                dosenNidn: dosen.nidn,
                userId: parseInt(req.user.id)
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

        if (title && title.trim().length > 150) {
            return res.status(400).json({ message: "Judul materi maksimal 150 karakter" });
        }
        
        const download = await prisma.download.update({
            where: { id: parseInt(id) },
            data: { title: title ? title.trim() : undefined, description, fileUrl, fileType }
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
        
        const isImage = req.file.mimetype && req.file.mimetype.startsWith('image/');
        let finalFilename = req.file.filename;

        if (isImage) {
            const originalPath = req.file.path;
            const ext = path.extname(req.file.filename);
            const baseName = path.basename(req.file.filename, ext);
            const webpFilename = `${baseName}.webp`;
            const webpPath = path.join(path.dirname(originalPath), webpFilename);

            await sharp(originalPath)
                .webp({ quality: 85 })
                .toFile(webpPath);

            if (originalPath !== webpPath && fs.existsSync(originalPath)) {
                try { fs.unlinkSync(originalPath); } catch (e) {}
            }
            finalFilename = webpFilename;
        }

        const fileUrl = `/uploads/${finalFilename}`;
        res.json({ 
            url: fileUrl,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error("Upload File Error:", error);
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ 
            url: fileUrl,
            originalName: req.file.originalname,
            size: req.file.size
        });
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
