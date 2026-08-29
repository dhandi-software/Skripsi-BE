const { PrismaClient } = require('@prisma/client');
const { notifyJudulApproved, notifyPengajuanRevision } = require('../utils/emailService');
const prisma = new PrismaClient();

exports.createPengajuan = async (req, res) => {
    try {
        const {
            judul,
            dosenId,
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

        if (!dosenId) {
             console.error("Invalid dosenNidn:", dosenId);
             return res.status(400).json({ message: "Invalid or missing Dosen ID" });
        }

        // Verify if selected dosen is Dosen Reguler (Viewer Only)
        const checkDosen = await prisma.dosen.findUnique({
            where: { nidn: dosenId }
        });

        if (checkDosen && checkDosen.jabatan && checkDosen.jabatan.toLowerCase().includes("reguler")) {
            return res.status(403).json({ message: "Dosen Reguler tidak dapat dipilih sebagai pembimbing." });
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
            // Check for existing Pengajuan to prevent multiple submissions
            const existingPengajuan = await prisma.pengajuanJudul.findFirst({
                where: { mahasiswaNim: mahasiswa.nim },
                orderBy: { tanggal: 'desc' }
            });

            // Check if student has EVER had any proposal approved by Koordinator
            const pastKoordinatorApproval = await prisma.pengajuanJudul.findFirst({
                where: { 
                    mahasiswaNim: mahasiswa.nim,
                    status: { in: ['PENDING', 'APPROVED', 'REVISION', 'CANCELLED_KOORDINATOR_APPROVED'] }
                }
            });

            const isApprovedByKoordinator = mahasiswa.isKoordinatorApproved || !!pastKoordinatorApproval;

            // If student was EVER approved by Koordinator, skip Koordinator!
            let newStatus = isApprovedByKoordinator ? 'PENDING' : 'PENDING_KOORDINATOR';

            if (isApprovedByKoordinator && !mahasiswa.isKoordinatorApproved) {
                try {
                    await prisma.mahasiswa.update({
                        where: { nim: mahasiswa.nim },
                        data: { isKoordinatorApproved: true }
                    });
                } catch (mErr) {
                    console.error("Failed to sync isKoordinatorApproved:", mErr);
                }
            }

            if (existingPengajuan) {
                if (existingPengajuan.status === 'PENDING_KOORDINATOR' && !mahasiswa.isKoordinatorApproved) {
                    return res.status(400).json({ message: "Anda sudah memiliki pengajuan yang sedang diproses oleh Koordinator." });
                }

                if (existingPengajuan.status === 'APPROVED') {
                    return res.status(400).json({ message: "Pengajuan Anda sudah disetujui secara final oleh Dosen Pembimbing." });
                }

                pengajuan = await prisma.pengajuanJudul.update({
                    where: { id: existingPengajuan.id },
                    data: {
                        dosenNidn: dosenId,
                        judul,
                        peminatan,
                        semester: String(semester),
                        tahunAkademik,
                        sksDicapai: String(sksDicapai),
                        sksNilaiD: String(sksNilaiD),
                        ipk: String(ipk),
                        batasStudi,
                        status: newStatus,
                        tanggal: new Date(), // Update timestamp
                        remarks: null // Clear old remarks
                    }
                });
            } else {
                // First time submitting
                pengajuan = await prisma.pengajuanJudul.create({
                    data: {
                        mahasiswaNim: mahasiswa.nim,
                        dosenNidn: dosenId,
                        judul,
                        peminatan,
                        semester: String(semester),
                        tahunAkademik,
                        sksDicapai: String(sksDicapai),
                        sksNilaiD: String(sksNilaiD),
                        ipk: String(ipk),
                        batasStudi,
                        status: newStatus
                    }
                });
            }
        } catch (dbError) {
            console.error("Database Error during Pengajuan creation/update:", dbError);
            return res.status(500).json({ message: "Database Error: " + dbError.message });
        }

        // Notify Koordinator or Dosen (Optional: Create Message)
        try {
            const currentStatus = pengajuan.status;
            
            if (currentStatus === 'PENDING_KOORDINATOR') {
                // Notifikasi ke semua dosen Koordinator
                const koordinators = await prisma.dosen.findMany({
                    where: {
                        jabatan: {
                            contains: 'koordinator',
                            mode: 'insensitive'
                        }
                    },
                    include: { user: true }
                });

                for (const koor of koordinators) {
                    if (koor.user) {
                        await prisma.message.create({
                            data: {
                                senderId: req.user.id,
                                receiverId: koor.user.id,
                                content: `Persetujuan dibutuhkan untuk Pengajuan Judul: "${judul}" oleh ${mahasiswa.nama}`,
                                isRead: false
                            }
                        });
                    }
                }
            } else {
                 const dosen = await prisma.dosen.findUnique({
                     where: { nidn: dosenId },
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
            }
        } catch (notifyError) {
             console.error("Failed to send notification (non-blocking):", notifyError);
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
                nama: true,
                jabatan: true,
                nidn: true,
                peminatan: true,
                maxBimbingan: true
            }
        });

        // Hitung jumlah bimbingan (pengajuan yang di-approve) per dosen
        const countBimbingan = await prisma.pengajuanJudul.groupBy({
            by: ['dosenNidn'],
            where: {
                status: 'APPROVED'
            },
            _count: {
                dosenNidn: true
            }
        });

        const bimbinganMap = {};
        countBimbingan.forEach(item => {
            bimbinganMap[item.dosenNidn] = item._count.dosenNidn;
        });

        const dosenWithKuota = dosenList.map(dosen => ({
            ...dosen,
            terisi: bimbinganMap[dosen.nidn] || 0,
            kuota: dosen.maxBimbingan !== undefined ? dosen.maxBimbingan : 6
        }));

        console.log("Dosen list fetched:", dosenList.length);
        res.json(dosenWithKuota);
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

        // Auto-heal status for Koordinator-approved Mahasiswa
        const hasPastApproval = mahasiswa.isKoordinatorApproved || (mahasiswa.pengajuanJudul && mahasiswa.pengajuanJudul.some(p => ['PENDING', 'APPROVED', 'REVISION', 'CANCELLED_KOORDINATOR_APPROVED'].includes(p.status)));
        
        if (hasPastApproval) {
            if (!mahasiswa.isKoordinatorApproved) {
                try {
                    await prisma.mahasiswa.update({
                        where: { nim: mahasiswa.nim },
                        data: { isKoordinatorApproved: true }
                    });
                    mahasiswa.isKoordinatorApproved = true;
                } catch (e) {
                    console.error("Failed to sync isKoordinatorApproved:", e);
                }
            }

            if (mahasiswa.pengajuanJudul && mahasiswa.pengajuanJudul.length > 0 && mahasiswa.pengajuanJudul[0].status === 'PENDING_KOORDINATOR') {
                try {
                    await prisma.pengajuanJudul.update({
                        where: { id: mahasiswa.pengajuanJudul[0].id },
                        data: { status: 'PENDING' }
                    });
                    mahasiswa.pengajuanJudul[0].status = 'PENDING';
                } catch (e) {
                    console.error("Failed to auto-heal status to PENDING:", e);
                }
            }
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

        const isKoordinator = (dosen.jabatan || '').toLowerCase().includes('koordinator');

        let whereClause = {};
        if (isKoordinator) {
            whereClause = {
                OR: [
                    { status: 'PENDING_KOORDINATOR' },
                    { dosenNidn: dosen.nidn, status: { notIn: ['PENDING_KOORDINATOR', 'REVISION_KOORDINATOR', 'REJECTED_KOORDINATOR'] } }
                ]
            };
        } else {
            whereClause = {
                dosenNidn: dosen.nidn,
                status: { notIn: ['PENDING_KOORDINATOR', 'REVISION_KOORDINATOR', 'REJECTED_KOORDINATOR'] }
            };
        }

        const pengajuanList = await prisma.pengajuanJudul.findMany({
            where: whereClause,
            include: {
                mahasiswa: true
            },
            orderBy: {
                tanggal: 'desc'
            }
        });

        pengajuanList.sort((a, b) => {
            const isAPending = a.status === 'PENDING' || a.status === 'PENDING_KOORDINATOR';
            const isBPending = b.status === 'PENDING' || b.status === 'PENDING_KOORDINATOR';
            
            if (isAPending && !isBPending) return -1;
            if (!isAPending && isBPending) return 1;
            return 0; // maintain date sorting for items in the same group
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
        const { status, remarks, deadlineRevisi } = req.body; // remarks optional for message

        if (!['APPROVED', 'REJECTED', 'REVISION', 'PENDING', 'PENDING_KOORDINATOR'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const existingPengajuan = await prisma.pengajuanJudul.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingPengajuan) {
            return res.status(404).json({ message: "Pengajuan not found" });
        }

        let dbStatus = status;
        if (existingPengajuan.status === 'PENDING_KOORDINATOR') {
            if (status === 'APPROVED') {
                dbStatus = 'PENDING';
                try {
                    await prisma.mahasiswa.update({
                        where: { nim: existingPengajuan.mahasiswaNim },
                        data: { isKoordinatorApproved: true }
                    });
                } catch (mErr) {
                    console.error("Failed to update isKoordinatorApproved:", mErr);
                }
            }
            else if (status === 'REVISION') dbStatus = 'REVISION_KOORDINATOR';
            else if (status === 'REJECTED') dbStatus = 'REJECTED_KOORDINATOR';
        }

        const pengajuan = await prisma.pengajuanJudul.update({
            where: { id: parseInt(id) },
            data: { 
                status: dbStatus,
                remarks: remarks || null,  // simpan catatan dosen
                deadlineRevisi: deadlineRevisi ? new Date(deadlineRevisi) : null,
                tanggal: new Date()        // update tanggal to the approval/status update date!
            },
            include: { mahasiswa: { include: { user: true } } }
        });

        // Notify Mahasiswa via In-App Message
        if (pengajuan.mahasiswa && pengajuan.mahasiswa.user) {
            try {
                let msgContent = `Your Title Proposal "${pengajuan.judul}" has been ${dbStatus}.`;
                if (dbStatus === 'PENDING') msgContent = `Your Title Proposal "${pengajuan.judul}" has been Approved by Koordinator and is now Pending for Pembimbing.`;
                
                await prisma.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: pengajuan.mahasiswa.user.id,
                        content: `${msgContent}${remarks ? ` Remarks: ${remarks}` : ''}`,
                        isRead: false
                    }
                });
            } catch (notifyError) {
                console.error("Failed to notify student:", notifyError);
            }
        }

        // Kirim Notifikasi Email Otomatis ke Email Masing-Masing Mahasiswa Sesuai Status (APPROVED, REVISION, REJECTED)
        if (pengajuan.mahasiswa && pengajuan.mahasiswa.email) {
            const studentEmail = pengajuan.mahasiswa.email;
            const studentName = pengajuan.mahasiswa.nama;
            const title = pengajuan.judul;

            prisma.dosen.findUnique({ where: { nidn: pengajuan.dosenNidn } })
                .then(targetDosen => targetDosen ? targetDosen.nama : "Dosen Pembimbing")
                .catch(() => "Dosen Pembimbing")
                .then(dosenName => {
                    console.log(`📧 [NOTIFY STATUS] Sending email for status '${dbStatus}' to ${studentEmail}`);
                    if (dbStatus === 'APPROVED') {
                        notifyJudulApproved(studentEmail, studentName, title, dosenName)
                            .catch(err => console.error("Email approve notify error:", err.message));
                    } else if (dbStatus === 'REVISION' || dbStatus === 'REVISION_KOORDINATOR' || dbStatus === 'REJECTED' || dbStatus === 'REJECTED_KOORDINATOR') {
                        const deadlineStr = pengajuan.deadlineRevisi ? new Date(pengajuan.deadlineRevisi).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
                        notifyPengajuanRevision(studentEmail, studentName, title, dosenName, remarks, deadlineStr)
                            .catch(err => console.error("Email revision notify error:", err.message));
                    }
                });
        } else {
            console.warn(`⚠️ [NOTIFY STATUS] Student email missing for pengajuan ID ${id}`);
        }

        // Jika Koordinator approve (status jadi PENDING), beritahu Dosen Pembimbing
        if (dbStatus === 'PENDING') {
            try {
                const targetDosen = await prisma.dosen.findUnique({
                    where: { nidn: pengajuan.dosenNidn },
                    include: { user: true }
                });
                
                if (targetDosen && targetDosen.user) {
                    await prisma.message.create({
                        data: {
                            senderId: req.user.id,
                            receiverId: targetDosen.user.id,
                            content: `New Title Proposal forwarded to you: "${pengajuan.judul}" by ${pengajuan.mahasiswa.nama}`,
                            isRead: false
                        }
                    });
                }
            } catch (dosenNotifyError) {
                console.error("Failed to notify dosen pembimbing:", dosenNotifyError);
            }
        }

        res.json({ message: `Pengajuan ${dbStatus}`, data: pengajuan });
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
                    include: { 
                        user: true,
                        bimbingan: true 
                    }
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
        const { nama, email, nomorTelepon } = req.body;
        const file = req.file;

        const updateData = {};
        if (file) {
            updateData.photo = `/uploads/profile/${file.filename}`;
        }
        if (email) updateData.email = email;
        if (nomorTelepon) updateData.nomorTelepon = nomorTelepon;
        if (nama) updateData.nama = nama;

        if (Object.keys(updateData).length > 0) {
            await prisma.mahasiswa.update({
                where: { userId: req.user.id },
                data: updateData
            });
        }
        const updatedUser = await prisma.user.findUnique({ where: { id: req.user.id } });

        res.json({ message: "Profile updated successfully", data: updatedUser });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ 
            message: "Internal server error: " + error.message,
            error: error
        });
    }
};

// ==========================================
// PUBLIC PROFILE
// ==========================================
exports.getPublicProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            include: {
                mahasiswa: true,
                dosen: true,
                staf: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Return a clean public profile object
        const publicProfile = {
            id: user.id,
            role: user.role
        };

        if (user.mahasiswa) {
            publicProfile.nama = user.mahasiswa.nama;
            publicProfile.identitas = user.mahasiswa.nim; // NIM
            publicProfile.email = user.mahasiswa.email;
            publicProfile.photo = user.mahasiswa.photo;
            publicProfile.nomorTelepon = user.mahasiswa.nomorTelepon;
        } else if (user.dosen) {
            publicProfile.nama = user.dosen.nama;
            publicProfile.identitas = user.dosen.nidn; // NIDN
            publicProfile.subRole = user.dosen.jabatan; // Jabatan
            publicProfile.email = user.dosen.email;
            publicProfile.photo = user.dosen.photo;
            publicProfile.nomorTelepon = user.dosen.nomorTelepon;
        } else if (user.staf) {
            publicProfile.nama = user.staf.nama;
            publicProfile.identitas = "-";
            publicProfile.subRole = "Staf Administrasi";
            publicProfile.email = user.staf.email;
            publicProfile.photo = user.staf.photo;
            publicProfile.nomorTelepon = user.staf.nomorTelepon;
        }

        res.json({
            message: "Success fetching public profile",
            data: publicProfile
        });
    } catch (error) {
        console.error("Get Public Profile Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan server saat mengambil profil" });
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
        const { nama, jabatan, email, nomorTelepon } = req.body;
        const file = req.file;

        const updateData = {};
        if (file) {
            updateData.photo = `/uploads/profile/${file.filename}`;
        }
        if (email) updateData.email = email;
        if (nomorTelepon) updateData.nomorTelepon = nomorTelepon;

        if (nama) updateData.nama = nama;
        if (jabatan) updateData.jabatan = jabatan;

        if (Object.keys(updateData).length > 0) {
            await prisma.dosen.update({
                where: { userId: req.user.id },
                data: updateData
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
        if (pengajuan.mahasiswaNim !== mahasiswa.nim) {
            return res.status(403).json({ message: "You are not authorized to cancel this proposal" });
        }

        // 4. Verify status (Allow cancellation only if PENDING or REVISION)
        // If it's REVISION, the student might want to just delete it and start over.
        const allowedStatuses = ['PENDING', 'PENDING_KOORDINATOR', 'REVISION', 'REVISION_KOORDINATOR'];
        if (!allowedStatuses.includes(pengajuan.status)) {
            return res.status(400).json({ message: "Hanya pengajuan dengan status PENDING atau REVISION yang dapat dibatalkan" });
        }

        // 5. Check if Koordinator had already approved it (status was PENDING or REVISION) or student is already approved
        const isApprovedByKoordinator = pengajuan.status === 'PENDING' || pengajuan.status === 'REVISION' || mahasiswa.isKoordinatorApproved;

        if (isApprovedByKoordinator && !mahasiswa.isKoordinatorApproved) {
            try {
                await prisma.mahasiswa.update({
                    where: { nim: mahasiswa.nim },
                    data: { isKoordinatorApproved: true }
                });
            } catch (mErr) {
                console.error("Failed to set isKoordinatorApproved on cancel:", mErr);
            }
        }

        const cancelStatus = isApprovedByKoordinator ? 'CANCELLED_KOORDINATOR_APPROVED' : 'CANCELLED';

        await prisma.pengajuanJudul.update({
            where: { id: parseInt(id) },
            data: {
                status: cancelStatus
            }
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
            email: staf.email,
            nomorTelepon: staf.nomorTelepon,
            role: staf.user.role,
            photo: staf.photo
        };

        res.json(profile);
    } catch (error) {
        console.error("Get Staf Profile Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateStafProfile = async (req, res) => {
    try {
        const { nama, email, nomorTelepon } = req.body;
        const file = req.file;

        await prisma.$transaction(async (tx) => {
            const stafUpdate = {};
            if (nama) stafUpdate.nama = nama;
            if (email) stafUpdate.email = email;
            if (nomorTelepon) stafUpdate.nomorTelepon = nomorTelepon;
            if (file) stafUpdate.photo = `/uploads/profile/${file.filename}`;

            if (Object.keys(stafUpdate).length > 0) {
                await tx.staf.update({
                    where: { userId: req.user.id },
                    data: stafUpdate
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
                email: freshStaf.email,
                nomorTelepon: freshStaf.nomorTelepon,
                role: freshStaf.user.role,
                photo: freshStaf.photo
            }
        });
    } catch (error) {
        console.error("Update Staf Profile Error:", error);
        res.status(500).json({ message: "Internal server error: " + error.message });
    }
};
