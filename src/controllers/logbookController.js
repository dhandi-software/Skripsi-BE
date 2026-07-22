const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to get owner (Mahasiswa or Dosen) based on user ID
const getOwner = async (userId, targetMahasiswaId = null) => {
    let owner = await prisma.mahasiswa.findUnique({
        where: { userId }
    });
    let type = 'mahasiswa';

    // If user is not a mahasiswa, check if they are a dosen
    if (!owner) {
        const dosen = await prisma.dosen.findUnique({
            where: { userId }
        });
        
        if (dosen) {
            type = 'dosen';
            // If a targetMahasiswaId is provided, verify the Dosen is the supervisor
            if (targetMahasiswaId) {
                const bimbingan = await prisma.bimbingan.findFirst({
                    where: {
                        mahasiswaNim: targetMahasiswaId,
                        dosenNidn: dosen.nidn
                    }
                });
                // Or check PengajuanJudul
                const pengajuan = await prisma.pengajuanJudul.findFirst({
                    where: {
                        mahasiswaNim: targetMahasiswaId,
                        dosenNidn: dosen.nidn,
                        status: 'APPROVED'
                    }
                });

                if (!bimbingan && !pengajuan) {
                    return { owner: null, type: 'unauthorized' };
                }

                owner = await prisma.mahasiswa.findUnique({
                    where: { nim: targetMahasiswaId }
                });
            } else {
                owner = dosen;
            }
        }
    }

    return { owner, type };
};

// Mengambil informasi header perusahaan untuk logbook
exports.getTempatKP = async (req, res) => {
    try {
        const { mahasiswaId } = req.query; // mahasiswaId here means NIM
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner) {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        const finalOwnerId = (type === 'dosen' && mahasiswaId) ? mahasiswaId : (type === 'mahasiswa' ? owner.nim : null);
        
        console.log("DEBUG getTempatKP:", { finalOwnerId, type });
        // Use Prisma directly since it's cleaner than raw SQL for strings if possible.
        let info = null;
        if (finalOwnerId) {
             const mhs = await prisma.mahasiswa.findUnique({
                 where: { nim: finalOwnerId },
                 include: { tempatKP: true }
             });
             info = mhs?.tempatKP?.[0] || null;
        }

        if (!info) {
            info = {
                namaPerusahaan: "",
                tlpFaxPerusahaan: "",
                alamatPerusahaan: "",
                kontakPembimbing: ""
            };
        }

        res.json(info);
    } catch (error) {
        console.error("Get Logbook Info Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Memperbarui atau membuat informasi perusahaan baru
exports.updateTempatKP = async (req, res) => {
    try {
        const { namaPerusahaan, tlpFaxPerusahaan, alamatPerusahaan, kontakPembimbing } = req.body;
        const { mahasiswaId } = req.query; // This is NIM
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        const data = {
            namaPerusahaan,
            tlpFaxPerusahaan,
            alamatPerusahaan,
            kontakPembimbing
        };

        let targetNim;
        if (type === 'dosen' && mahasiswaId) {
            targetNim = mahasiswaId;
        } else if (type === 'mahasiswa') {
            targetNim = owner.nim;
        } else {
             return res.status(403).json({ message: "Hanya untuk mahasiswa" }); // Dosen logbook info has been removed in schema changes.
        }

        const existingInfo = await prisma.tempatKP.findFirst({
            where: { mahasiswaNim: targetNim }
        });

        let info;
        if (existingInfo) {
            info = await prisma.tempatKP.update({
                where: { id: existingInfo.id },
                data
            });
        } else {
            info = await prisma.tempatKP.create({
                data: {
                    ...data,
                    mahasiswaNim: targetNim
                }
            });
        }

        res.json({ message: "Info logbook diperbarui", data: info });
    } catch (error) {
        console.error("Update Logbook Info Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Mengambil daftar seluruh kegiatan logbook mahasiswa/dosen
exports.getLogbooks = async (req, res) => {
    try {
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        let targetNim;
        if (type === 'dosen' && mahasiswaId) {
            targetNim = mahasiswaId;
        } else if (type === 'mahasiswa') {
            targetNim = owner.nim;
        } else {
            return res.json([]);
        }

        console.log("DEBUG getLogbooks:", { type, mahasiswaId, targetNim });
        
        let logbooks = await prisma.logbook.findMany({
            where: { mahasiswaNim: targetNim },
            orderBy: { tanggalPukul: 'asc' }
        });
        
        console.log(`DEBUG getLogbooks found ${logbooks.length} entries`);

        const formattedLogbooks = logbooks.map(lb => ({
            id: lb.id.toString(),
            tanggalPukul: lb.tanggalPukul.toISOString(),
            uraian: lb.uraian,
            mahasiswaParaf: lb.mahasiswaParaf,
            pembimbingParaf: lb.pembimbingParaf,
            catatan: lb.catatan || ""
        }));

        res.json(formattedLogbooks);
    } catch (error) {
        console.error("Get Logbooks Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

// Sinkronisasi data logbook
exports.syncLogbooks = async (req, res) => {
    try {
        const { entries } = req.body;
        const { mahasiswaId } = req.query;
        const { owner, type } = await getOwner(req.user.id, mahasiswaId);

        if (!owner || type === 'unauthorized') {
            return res.status(type === 'unauthorized' ? 403 : 404).json({ message: "Profil tidak ditemukan atau tidak berwenang" });
        }

        if (!Array.isArray(entries)) {
            return res.status(400).json({ message: "Entries harus berupa array" });
        }

        let targetNim;
        if (type === 'dosen' && mahasiswaId) {
            targetNim = mahasiswaId;
        } else if (type === 'mahasiswa') {
            targetNim = owner.nim;
        } else {
            return res.status(400).json({ message: "Dosen cannot have logbook." });
        }

        if (type === 'mahasiswa' || (type === 'dosen' && !mahasiswaId)) {
            const existingIdsToKeep = entries
                .filter(e => parseInt(e.id) < 1000000000000)
                .map(e => parseInt(e.id));
                
            await prisma.logbook.deleteMany({
                where: {
                    mahasiswaNim: targetNim,
                    id: { notIn: existingIdsToKeep }
                }
            });
        }

        for (const entry of entries) {
            const dateObj = entry.tanggalPukul ? new Date(entry.tanggalPukul) : new Date();
            
            const data = {
                tanggalPukul: dateObj,
                uraian: entry.uraian || "",
                mahasiswaParaf: entry.mahasiswaParaf || null,
                pembimbingParaf: entry.pembimbingParaf || null,
                catatan: entry.catatan || ""
            };
            
            if (parseInt(entry.id) > 1000000000000) {
                if (type === 'mahasiswa' || (type === 'dosen' && !mahasiswaId)) {
                    await prisma.logbook.create({
                        data: {
                            ...data,
                            mahasiswaNim: targetNim
                        }
                    });
                }
            } else {
                await prisma.logbook.update({
                    where: { id: parseInt(entry.id) },
                    data: data
                });
            }
        }

        res.json({ message: "Logbook berhasil disinkronisasi" });
    } catch (error) {
        console.error("Sync Logbook Error Details:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server", error: error.message });
    }
};

exports.getStudentProfile = async (req, res) => {
    try {
        const { id } = req.params; // this is NIM
        const mahasiswa = await prisma.mahasiswa.findUnique({
            where: { nim: id },
            include: { 
                user: true,
                pengajuanJudul: {
                    orderBy: { tanggal: 'desc' },
                    take: 1
                }
            }
        });
        
        if (!mahasiswa) {
             return res.status(404).json({ message: "Data mahasiswa tidak ditemukan" });
        }
        res.json(mahasiswa);
    } catch (error) {
        console.error("Get Logbook Student Profile Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};

exports.getCompanyList = async (req, res) => {
    try {
        const companies = await prisma.tempatKP.findMany({
            distinct: ['namaPerusahaan'],
            where: {
                namaPerusahaan: { not: null, not: "" }
            },
            select: {
                namaPerusahaan: true,
                tlpFaxPerusahaan: true,
                alamatPerusahaan: true,
                kontakPembimbing: true
            },
            orderBy: { namaPerusahaan: 'asc' }
        });
        res.json(companies);
    } catch (error) {
        console.error("Get Company List Error:", error);
        res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
};
