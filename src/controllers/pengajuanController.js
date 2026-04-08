const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createPengajuan = async (req, res) => {
    try {
        const {
            dosenId,
            judul,
            peminatan,
            semester,
            tahunAkademik,
            sksDicapai,
            sksNilaiD,
            ipk,
            batasStudi
        } = req.body;
        
        // Debug log
        console.log("createPengajuan payload:", req.body);
        console.log("User ID:", req.user.id);

        if (!dosenId || isNaN(parseInt(dosenId))) {
             console.error("Invalid dosenId:", dosenId);
             return res.status(400).json({ message: "Invalid or missing Dosen ID" });
        }
        
        // Find Mahasiswa profile
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) {
            console.error("Mahasiswa profile not found for user:", req.user.id);
            return res.status(404).json({ message: "Mahasiswa profile not found" });
        }

        let pengajuan;
        try {
            pengajuan = await prisma.pengajuanJudul.create({
                data: {
                    mahasiswaId: mahasiswa.id,
                    dosenId: parseInt(dosenId),
                    judul,
                    peminatan,
                    semester: String(semester),
                    tahunAkademik,
                    sksDicapai: String(sksDicapai),
                    sksNilaiD: String(sksNilaiD),
                    ipk: String(ipk),
                    batasStudi,
                    status: 'PENDING'
                }
            });
        } catch (dbError) {
            console.error("Database Error during Pengajuan creation:", dbError);
            return res.status(500).json({ message: "Database Error: " + dbError.message });
        }

        // Notify Dosen (Optional: Create Message)
        try {
             const dosen = await prisma.dosen.findUnique({
                 where: { id: parseInt(dosenId) },
                 include: { user: true }
             });
            
             if (dosen && dosen.user) {
                 await prisma.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: dosen.user.id,
                        content: `New Title Proposal: "${judul}" by ${mahasiswa.nama}`,
                        isRead: false
                    }
                });
             }
        } catch (notifyError) {
             console.error("Failed to send notification (non-blocking):", notifyError);
             // Verify if this is causing the 500? No, it's swallowed here.
        }

        res.status(201).json({ message: "Pengajuan successful", data: pengajuan });
    } catch (error) {
        console.error("Create Pengajuan General Error:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};

exports.getDosenList = async (req, res) => {
    try {
        const dosenList = await prisma.dosen.findMany({
            select: {
                id: true,
                nama: true,
                jabatan: true,
                nidn: true
            }
        });
        console.log("Dosen list fetched:", dosenList.length);
        res.json(dosenList);
    } catch (error) {
         console.error("Get Dosen List Error:", error);
         res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMahasiswaProfile = async (req, res) => {
    try {
        console.log("Fetching profile for User ID:", req.user.id);
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id },
            include: { 
                user: true,
                pengajuanJudul: {
                    orderBy: { tanggal: 'desc' }
                }
            }
        });
        console.log("Profile found:", mahasiswa);
        
        if (!mahasiswa) {
             return res.status(404).json({ message: "Profile not found" });
        }
        res.json(mahasiswa);
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
exports.getPengajuanByDosen = async (req, res) => {
    try {
        // Find Dosen profile first
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id }
        });

        if (!dosen) {
            return res.status(404).json({ message: "Dosen profile not found" });
        }

        const pengajuanList = await prisma.pengajuanJudul.findMany({
            where: { dosenId: dosen.id },
            include: {
                mahasiswa: true
            },
            orderBy: {
                tanggal: 'desc'
            }
        });

        res.json(pengajuanList);
    } catch (error) {
        console.error("Get Pengajuan By Dosen Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updatePengajuanStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body; // remarks optional for message

        if (!['APPROVED', 'REJECTED', 'REVISION'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const pengajuan = await prisma.pengajuanJudul.update({
            where: { id: parseInt(id) },
            data: { 
                status,
                remarks: remarks || null  // simpan catatan dosen
            },
            include: { mahasiswa: { include: { user: true } } }
        });

        // Notify Mahasiswa
        if (pengajuan.mahasiswa && pengajuan.mahasiswa.user) {
            try {
                await prisma.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: pengajuan.mahasiswa.user.id,
                        content: `Your Title Proposal "${pengajuan.judul}" has been ${status}.${remarks ? ` Remarks: ${remarks}` : ''}`,
                        isRead: false
                    }
                });
            } catch (notifyError) {
                console.error("Failed to notify student:", notifyError);
            }
        }

        res.json({ message: `Pengajuan ${status}`, data: pengajuan });
    } catch (error) {
        console.error("Update Pengajuan Status Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPengajuanById = async (req, res) => {
    try {
        const { id } = req.params;
        const pengajuan = await prisma.pengajuanJudul.findUnique({
            where: { id: parseInt(id) },
            include: {
                mahasiswa: {
                    include: { user: true }
                },
                dosen: true
            }
        });

        if (!pengajuan) {
            return res.status(404).json({ message: "Pengajuan not found" });
        }

        res.json(pengajuan);
    } catch (error) {
        console.error("Get Pengajuan By Id Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
