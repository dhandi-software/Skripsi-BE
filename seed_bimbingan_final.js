const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed bimbingan final...');
    
    const pengajuans = await prisma.pengajuanJudul.findMany();
    
    // Update all pengajuan to APPROVED so they can have bimbingan
    await prisma.pengajuanJudul.updateMany({
        data: {
            status: 'APPROVED'
        }
    });

    console.log(`Updated ${pengajuans.length} pengajuan to APPROVED.`);

    const fileName = '/uploads/1783561604619-270988793.pdf';

    const topiks = [
        "Bab 1: Pendahuluan",
        "Bab 2: Tinjauan Pustaka",
        "Bab 3: Metodologi",
        "Bab 4: Hasil dan Pembahasan",
        "Bab 5: Kesimpulan dan Saran",
        "Laporan Akhir (Finalisasi)"
    ];

    let count = 0;

    for (const p of pengajuans) {
        // Delete existing bimbingan for this student to start fresh
        await prisma.bimbingan.deleteMany({
            where: {
                mahasiswaNim: p.mahasiswaNim
            }
        });

        for (let i = 0; i < topiks.length; i++) {
            const topik = topiks[i];
            // Simulate progression of dates
            const date = new Date();
            date.setDate(date.getDate() - (topiks.length - i) * 3); // 3 days apart

            await prisma.bimbingan.create({
                data: {
                    mahasiswaNim: p.mahasiswaNim,
                    dosenNidn: p.dosenNidn,
                    topik: topik,
                    catatan: 'Sudah baik, silahkan lanjut ke bab berikutnya.',
                    status: 'APPROVED',
                    fileMahasiswa: fileName,
                    keteranganProgres: `Revisi minor ${topik} sudah diselesaikan`,
                    isReadDosen: true,
                    tanggal: date
                }
            });
            count++;
        }
    }

    console.log(`Successfully created ${count} Bimbingan APPROVED for all students!`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
