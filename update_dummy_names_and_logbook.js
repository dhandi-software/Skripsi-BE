const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting dummy data update...');

    const firstNames = [
        "Andi", "Ahmad", "Rizky", "Dimas", "Ilham", "Fajar", "Reza", "Dika", "Wahyu",
        "Siti", "Putri", "Ayu", "Rina", "Dwi", "Annisa", "Novia", "Sari", "Nadia", "Maya",
        "Hendra", "Agus", "Eko", "Iqbal", "Aris", "Tri", "Bagus", "Deny", "Rangga", "Yoga",
        "Citra", "Nia", "Reni", "Intan", "Vina", "Fitri", "Susi", "Lina", "Ratih", "Dian"
    ];

    const lastNames = [
        "Santoso", "Saputra", "Fauzan", "Aditya", "Pratama", "Akbar", "Nugroho", "Ramadhan", "Setiawan", "Hidayat",
        "Nurhaliza", "Maharani", "Lestari", "Wati", "Kusuma", "Rahmawati", "Fitriani", "Indah", "Safitri", "Sari",
        "Wijaya", "Prasetyo", "Maulana", "Munandar", "Wibowo", "Pangestu", "Kurniawan", "Putra", "Kirana", "Ramadhani",
        "Marlina", "Permata", "Panduwinata", "Rahayu", "Susanti", "Purwasih", "Sastrowardoyo"
    ];

    // Find all mahasiswa whose name contains "Pejuang Skripsi"
    const dummyMahasiswas = await prisma.mahasiswa.findMany({
        where: {
            nama: {
                contains: "Pejuang Skripsi",
                mode: "insensitive"
            }
        }
    });

    console.log(`Found ${dummyMahasiswas.length} students with "Pejuang Skripsi" names.`);

    for (const m of dummyMahasiswas) {
        const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const newName = `${fName} ${lName}`;
        
        await prisma.mahasiswa.update({
            where: { nim: m.nim },
            data: { nama: newName }
        });
        console.log(`Updated ${m.nim} from "${m.nama}" to "${newName}"`);
    }

    // Now for Logbook: find students who have APPROVED PengajuanJudul and BimbinganTasks
    const activePengajuan = await prisma.pengajuanJudul.findMany({
        where: { status: 'APPROVED' }
    });

    console.log(`Found ${activePengajuan.length} APPROVED PengajuanJudul.`);

    const logbookEntries = [
        "Mencari dan membaca literatur terkait topik skripsi",
        "Menyusun latar belakang dan rumusan masalah untuk Bab 1",
        "Melakukan diskusi dengan teman sebaya mengenai metodologi yang tepat",
        "Memperbaiki penulisan Bab 1 sesuai dengan revisi sebelumnya",
        "Mengumpulkan dataset yang diperlukan untuk eksperimen",
        "Mempelajari algoritma dan tools yang akan digunakan",
        "Menyusun instrumen pengumpulan data",
        "Melakukan instalasi dan konfigurasi environment sistem",
        "Mengolah data awal untuk persiapan analisis",
        "Menulis draf awal Tinjauan Pustaka",
        "Menyusun kuesioner dan menyebarkannya ke responden",
        "Melakukan uji coba awal algoritma pada dataset kecil",
        "Bimbingan rutin mengenai progres pengembangan sistem",
        "Merapikan format dokumen sesuai panduan skripsi",
        "Membuat laporan progres mingguan"
    ];

    let logbookCount = 0;

    for (const pengajuan of activePengajuan) {
        // Find existing logbooks to avoid duplicates if we run this multiple times
        const existingLogbook = await prisma.logbook.findMany({
            where: { mahasiswaNim: pengajuan.mahasiswaNim }
        });

        if (existingLogbook.length < 5) {
            // Generate some random logbooks for them
            const numLogbooksToCreate = Math.floor(Math.random() * 5) + 3; // 3 to 7 logbooks
            for (let i = 0; i < numLogbooksToCreate; i++) {
                const activity = logbookEntries[Math.floor(Math.random() * logbookEntries.length)];
                
                // Random date within the last 30 days
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 30));
                
                await prisma.logbook.create({
                    data: {
                        mahasiswaNim: pengajuan.mahasiswaNim,
                        tanggalPukul: date,
                        uraian: activity
                    }
                });
                logbookCount++;
            }
            console.log(`Created logbooks for ${pengajuan.mahasiswaNim}`);
        }
    }

    console.log(`Successfully created ${logbookCount} logbook entries.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
