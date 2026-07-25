const SanksiModel = require('../models/sanksiModel');
const prisma = require('../prisma');

class SanksiController {
    
    async syncSanksiStatus(list) {
        const now = new Date();
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            
            // If already confirmed, don't recalculate dynamic values
            if (item.tanggalKonfirmasi) {
                continue;
            }

            if ((item.status === 'Menunggu Hardcover' || item.status === 'Terlambat') && item.tenggatWaktu) {
                let keterlambatanMinggu = 0;
                let denda = 0;
                let newStatus = item.status;
                
                if (now > item.tenggatWaktu) {
                    const diffTime = Math.abs(now - item.tenggatWaktu);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    keterlambatanMinggu = Math.ceil(diffDays / 7);
                    
                    if (keterlambatanMinggu > 4) {
                        keterlambatanMinggu = 4;
                    }
                    denda = keterlambatanMinggu * 50000;
                    newStatus = 'Terlambat';
                }

                if (item.denda !== denda || item.keterlambatanMinggu !== keterlambatanMinggu || item.status !== newStatus) {
                    await SanksiModel.update(item.id, {
                        status: newStatus,
                        keterlambatanMinggu,
                        denda
                    });
                    item.status = newStatus;
                    item.keterlambatanMinggu = keterlambatanMinggu;
                    item.denda = denda;
                }
            }
        }
        return list;
    }

    getAllSanksi = async (req, res) => {
        try {
            const { search, status } = req.query;
            const role = req.user.role.toUpperCase();
            
            let list = [];
            if (role === 'MAHASISWA') {
                const student = await prisma.mahasiswa.findUnique({
                    where: { userId: req.user.id }
                });
                if (!student) return res.status(404).json({ message: "Student profile not found" });
                list = await SanksiModel.findByMahasiswaNim(student.nim);
            } else {
                // DOSEN, KAPRODI, STAF, ADMIN
                list = await SanksiModel.findAllWithRelations();
            }
            
            const syncedList = await this.syncSanksiStatus(list);

            // Calculate summary before filtering
            const summary = {
                total: syncedList.length,
                menunggu: 0,
                telat: 0,
                selesai: 0
            };

            for (const item of syncedList) {
                if (!item.status || item.status === 'Menunggu Hardcover') summary.menunggu++;
                else if (item.status === 'Terlambat') summary.telat++;
                else if (item.status === 'Selesai/Lunas' || item.status === 'Selesai') summary.selesai++;
            }

            // Filter data
            let filteredList = syncedList;

            if (search) {
                const q = search.toLowerCase();
                filteredList = filteredList.filter(item => 
                    (item.nama && item.nama.toLowerCase().includes(q)) ||
                    (item.nim && item.nim.toLowerCase().includes(q)) ||
                    (item.dosen?.nama && item.dosen.nama.toLowerCase().includes(q))
                );
            }

            if (status) {
                if (status === 'Menunggu') {
                    filteredList = filteredList.filter(item => !item.status || item.status === 'Menunggu Hardcover');
                } else if (status === 'Terlambat') {
                    filteredList = filteredList.filter(item => item.status === 'Terlambat');
                } else if (status === 'Selesai') {
                    filteredList = filteredList.filter(item => item.status === 'Selesai/Lunas' || item.status === 'Selesai');
                }
            }

            return res.json({ data: filteredList, summary });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    getSupervisedStudents = async (req, res) => {
        try {
            // Ambil semua mahasiswa
            const list = await prisma.mahasiswa.findMany({
                include: {
                    sidang: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                },
                orderBy: { nama: 'asc' }
            });

            const existingSanksi = await SanksiModel.findMany({
                select: { mahasiswaNim: true }
            });
            const hasSanksiSet = new Set(existingSanksi.map(s => s.mahasiswaNim));

            const students = [];
            for (const item of list) {
                if (!hasSanksiSet.has(item.nim)) {
                    const statusSidang = item.sidang && item.sidang.length > 0 ? item.sidang[0].status : null;
                    const tanggalSidang = item.sidang && item.sidang.length > 0 ? item.sidang[0].tanggalSidang : null;
                    
                    if (statusSidang === 'TERJADWAL' && tanggalSidang) {
                        students.push({
                            id: item.nim,
                            nama: item.nama,
                            nim: item.nim,
                            tanggalSidang: tanggalSidang,
                            statusSidang: statusSidang
                        });
                    }
                }
            }

            res.json(students);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    createSanksi = async (req, res) => {
        const { mahasiswaId, nama, nim, hariSidang, tanggalSidang, hariTenggat, tanggalSurat, rawTanggalSidang } = req.body;
        try {
            let tenggatWaktu = null;
            if (rawTanggalSidang) {
                const parsed = new Date(rawTanggalSidang);
                if (!isNaN(parsed.getTime())) {
                    parsed.setDate(parsed.getDate() + 7);
                    tenggatWaktu = parsed;
                }
            } else if (tanggalSidang) {
                const parsed = new Date(tanggalSidang);
                if (!isNaN(parsed.getTime())) {
                    parsed.setDate(parsed.getDate() + 7);
                    tenggatWaktu = parsed;
                }
            }

            const existingSanksi = await SanksiModel.findExistingByMahasiswa(mahasiswaId);

            if (existingSanksi) {
                return res.status(400).json({ error: "Mahasiswa ini sudah memiliki sanksi administrasi." });
            }
            
            let dosenId = null;
            const dosen = await prisma.dosen.findUnique({
                where: { userId: req.user.id }
            });

            if (dosen) {
                dosenId = dosen.nidn;
            } else {
                const approvedJudul = await prisma.pengajuanJudul.findFirst({
                    where: { mahasiswaNim: mahasiswaId, status: 'APPROVED' }
                });
                if (approvedJudul) {
                    dosenId = approvedJudul.dosenNidn;
                } else {
                    const firstDosen = await prisma.dosen.findFirst();
                    if (!firstDosen) return res.status(400).json({ message: "No Dosen found in system" });
                    dosenId = firstDosen.nidn;
                }
            }

            const newSanksi = await SanksiModel.create({
                data: {
                    mahasiswaNim: mahasiswaId,
                    dosenNidn: dosenId,
                    nama,
                    nim,
                    hariSidang,
                    tanggalSidang,
                    hariTenggat,
                    tanggalSurat,
                    tenggatWaktu,
                    status: 'Menunggu Hardcover'
                }
            });

            res.status(201).json(newSanksi);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    updateSanksi = async (req, res) => {
        const { id } = req.params;
        const { nama, nim, hariSidang, tanggalSidang, hariTenggat, tanggalSurat, rawTanggalSidang } = req.body;
        try {
            let dataToUpdate = {
                nama,
                nim,
                hariSidang,
                tanggalSidang,
                hariTenggat,
                tanggalSurat
            };

            if (rawTanggalSidang) {
                const parsed = new Date(rawTanggalSidang);
                if (!isNaN(parsed.getTime())) {
                    parsed.setDate(parsed.getDate() + 7);
                    dataToUpdate.tenggatWaktu = parsed;
                }
            } else if (tanggalSidang) {
                const parsed = new Date(tanggalSidang);
                if (!isNaN(parsed.getTime())) {
                    parsed.setDate(parsed.getDate() + 7);
                    dataToUpdate.tenggatWaktu = parsed;
                }
            }

            const updatedSanksi = await SanksiModel.update({
                where: { id: parseInt(id) },
                data: dataToUpdate
            });
            res.json(updatedSanksi);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    deleteSanksi = async (req, res) => {
        const { id } = req.params;
        try {
            await SanksiModel.delete({ where: { id: parseInt(id) } });
            res.json({ message: "Sanksi Administrasi deleted successfully" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    konfirmasiSanksi = async (req, res) => {
        const { id } = req.params;
        try {
            const sanksi = await SanksiModel.findUnique({ where: { id: parseInt(id) } });
            if (!sanksi) return res.status(404).json({ message: "Sanksi tidak ditemukan" });

            const now = new Date();
            let keterlambatanMinggu = 0;
            let denda = 0;

            if (sanksi.tenggatWaktu) {
                const examDate = new Date(sanksi.tenggatWaktu);
                examDate.setDate(examDate.getDate() - 7);
                if (now < examDate) {
                    return res.status(400).json({ error: "Mahasiswa belum melaksanakan ujian sidang. Konfirmasi hardcover tidak dapat dilakukan sebelum ujian sidang selesai." });
                }

                if (now > sanksi.tenggatWaktu) {
                    const diffTime = Math.abs(now - sanksi.tenggatWaktu);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    keterlambatanMinggu = Math.ceil(diffDays / 7);
                    if (keterlambatanMinggu > 4) keterlambatanMinggu = 4;
                    denda = keterlambatanMinggu * 50000;
                }
            }

            const updatedSanksi = await SanksiModel.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'Selesai',
                    tanggalKonfirmasi: now,
                    denda,
                    keterlambatanMinggu
                }
            });
            res.json(updatedSanksi);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };

    terimaHardcover = async (req, res) => {
        // Keep for backward compatibility if needed, but konfirmasiSanksi is the new proper way
        const { id } = req.params;
        try {
            const updatedSanksi = await SanksiModel.update({
                where: { id: parseInt(id) },
                data: { status: 'Selesai/Lunas' }
            });
            res.json(updatedSanksi);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    };
}

module.exports = new SanksiController();
