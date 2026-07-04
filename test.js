const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const dosen = await prisma.dosen.findFirst();
    if (!dosen) return console.log('No dosen');
    console.log('Testing for dosen:', dosen.nidn);

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
    console.log('Pengajuan length:', pengajuanList.length);
    if(pengajuanList.length > 0) {
        console.log('Mahasiswa sample:', pengajuanList[0].mahasiswa.nim);
        console.log('Mahasiswa logbooks:', pengajuanList[0].mahasiswa.logbook?.length);
    }
}

run().catch(console.error).finally(() => prisma.$disconnect());
