const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const dosens = await prisma.dosen.findMany();
    for (const dosen of dosens) {
        try {
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
                
                let statusProgress = 'Belum Mulai';
                if (latestBimbingan) {
                    if (latestBimbingan.status === 'APPROVED') statusProgress = 'Revisi Diterima';
                }

                const penilaian = item.penilaian && item.penilaian.length > 0 ? item.penilaian[0] : null;
                const pengajuan = mhs.pengajuanJudul && mhs.pengajuanJudul.length > 0 ? mhs.pengajuanJudul[0] : null;
                const logbooks = mhs.logbook || [];
                const logbooksApproved = logbooks.filter(l => l.pembimbingParaf !== null && l.pembimbingParaf !== "");

                return {
                    id: mhs.nim,
                    nama: mhs.nama,
                    nim: mhs.nim
                };
            });
            if (laporan.length > 0) {
                console.log('Dosen', dosen.nidn, 'has', laporan.length, 'laporan');
            }
        } catch (e) {
            console.error('Error for dosen', dosen.nidn, e.message);
        }
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
