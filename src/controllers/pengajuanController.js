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

exports.updateMahasiswaProfile = async (req, res) => {
    try {
        const { nama } = req.body;
        const file = req.file;

        const updateData = {};
        if (file) {
            updateData.photo = `/uploads/profile/${file.filename}`;
        }

        // Update User photo
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        // Update Mahasiswa nama if provided
        if (nama) {
            await prisma.mahasiswa.update({
                where: { userId: req.user.id },
                data: { nama }
            });
        }

        res.json({ message: "Profile updated successfully", data: updatedUser });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ 
            message: "Internal server error: " + error.message,
            error: error
        });
    }
};
exports.getDosenProfile = async (req, res) => {
    try {
        const dosen = await prisma.dosen.findUnique({
            where: { userId: req.user.id },
            include: { user: true }
        });
        
        if (!dosen) {
             return res.status(404).json({ message: "Dosen profile not found" });
        }
        res.json(dosen);
    } catch (error) {
        console.error("Get Dosen Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateDosenProfile = async (req, res) => {
    try {
        const { nama, jabatan } = req.body;
        const file = req.file;

        const updateData = {};
        if (file) {
            updateData.photo = `/uploads/profile/${file.filename}`;
        }

        // Update User photo
        if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: updateData
            });
        }

        // Update Dosen info if provided
        const dosenUpdate = {};
        if (nama) dosenUpdate.nama = nama;
        if (jabatan) dosenUpdate.jabatan = jabatan;

        if (Object.keys(dosenUpdate).length > 0) {
            await prisma.dosen.update({
                where: { userId: req.user.id },
                data: dosenUpdate
            });
        }

        // Get fresh data
        const freshProfile = await prisma.dosen.findUnique({
            where: { userId: req.user.id },
            include: { user: true }
        });

        res.json({ message: "Profile updated successfully", data: freshProfile });
    } catch (error) {
        console.error("Update Dosen Profile Error:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};

exports.cancelPengajuan = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find Mahasiswa profile
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { userId: req.user.id }
        });

        if (!mahasiswa) {
            return res.status(404).json({ message: "Mahasiswa profile not found" });
        }

        // 2. Find the proposal
        const pengajuan = await prisma.pengajuanJudul.findUnique({
            where: { id: parseInt(id) }
        });

        if (!pengajuan) {
            return res.status(404).json({ message: "Pengajuan not found" });
        }

        // 3. Verify ownership
        if (pengajuan.mahasiswaId !== mahasiswa.id) {
            return res.status(403).json({ message: "You are not authorized to cancel this proposal" });
        }

        // 4. Verify status (Allow cancellation only if PENDING or REVISION)
        // If it's REVISION, the student might want to just delete it and start over.
        if (pengajuan.status !== 'PENDING' && pengajuan.status !== 'REVISION') {
            return res.status(400).json({ message: "Hanya pengajuan dengan status PENDING atau REVISION yang dapat dibatalkan" });
        }

        // 5. Delete the proposal
        await prisma.pengajuanJudul.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: "Pengajuan berhasil dibatalkan" });
    } catch (error) {
        console.error("Cancel Pengajuan Error:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};

exports.getStafProfile = async (req, res) => {
    try {
        const staf = await prisma.staf.findUnique({
            where: { userId: req.user.id },
            include: { user: true }
        });
        
        if (!staf) {
             return res.status(404).json({ message: "Staf profile not found" });
        }

        // Flatten data for frontend
        const profile = {
            id: staf.user.id,
            nama: staf.nama,
            email: staf.user.email,
            role: staf.user.role,
            photo: staf.user.photo
        };

        res.json(profile);
    } catch (error) {
        console.error("Get Staf Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateStafProfile = async (req, res) => {
    try {
        const { nama, email } = req.body;
        const file = req.file;

        await prisma.$transaction(async (tx) => {
            // 1. Update User table (email and photo)
            const userUpdate = {};
            if (email) userUpdate.email = email;
            if (file) userUpdate.photo = `/uploads/profile/${file.filename}`;

            if (Object.keys(userUpdate).length > 0) {
                await tx.user.update({
                    where: { id: req.user.id },
                    data: userUpdate
                });
            }

            // 2. Update Staf table (nama)
            if (nama) {
                await tx.staf.update({
                    where: { userId: req.user.id },
                    data: { nama }
                });
            }
        });

        // Fetch fresh data
        const freshStaf = await prisma.staf.findUnique({
            where: { userId: req.user.id },
            include: { user: true }
        });

        res.json({ 
            message: "Profile updated successfully", 
            data: {
                id: freshStaf.user.id,
                nama: freshStaf.nama,
                email: freshStaf.user.email,
                role: freshStaf.user.role,
                photo: freshStaf.user.photo
            }
        });
    } catch (error) {
        console.error("Update Staf Profile Error:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};

