const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding KP Data...');

    // 1. Find all active students (from PengajuanJudul or Mahasiswa in general)
    // Here we'll grab all Mahasiswa who have an APPROVED PengajuanJudul (or just all Mahasiswa who don't have Tempat KP)
    const activePengajuan = await prisma.pengajuanJudul.findMany({
        where: { status: 'APPROVED' },
    });

    const perusahaans = [
        { nama: "PT Telkom Indonesia", alamat: "Jl. Japati No.1, Bandung", tlp: "022-4521404", kontak: "Bpk. Rahmat" },
        { nama: "PT Pertamina", alamat: "Jl. Medan Merdeka Timur 1A, Jakarta", tlp: "021-3815111", kontak: "Ibu Sinta" },
        { nama: "Bank Mandiri (Persero) Tbk", alamat: "Jl. Jenderal Gatot Subroto Kav. 36-38, Jakarta", tlp: "021-52997777", kontak: "Bpk. Dwi" },
        { nama: "PT PLN (Persero)", alamat: "Jl. Trunojoyo Blok M-1/135, Jakarta", tlp: "021-7251234", kontak: "Ibu Linda" },
        { nama: "Gojek Indonesia", alamat: "Pasaraya Blok M, Gedung B Lt. 6, Jakarta", tlp: "021-50849000", kontak: "Bpk. Kevin" },
        { nama: "Tokopedia", alamat: "Tokopedia Tower, Ciputra World 2, Jakarta", tlp: "021-53690111", kontak: "Ibu Melissa" },
        { nama: "PT Bank Rakyat Indonesia", alamat: "Gedung BRI 1, Jl. Jend. Sudirman Kav. 44-46, Jakarta", tlp: "021-5751966", kontak: "Bpk. Agung" },
        { nama: "Traveloka", alamat: "Traveloka Campus, BSD City, Tangerang", tlp: "021-29775800", kontak: "Ibu Rina" },
        { nama: "PT Indofood Sukses Makmur", alamat: "Sudirman Plaza Indofood Tower Lt. 27, Jakarta", tlp: "021-57958822", kontak: "Bpk. Arif" },
        { nama: "PT Telekomunikasi Selular (Telkomsel)", alamat: "Telkomsel Smart Office, Jakarta", tlp: "021-5240811", kontak: "Ibu Ningsih" },
        { nama: "Shopee Indonesia", alamat: "Pacific Century Place Tower Lt. 26, Jakarta", tlp: "021-39508999", kontak: "Bpk. Surya" },
        { nama: "PT Astra Internasional Tbk", alamat: "Menara Astra, Jl. Jend. Sudirman Kav 5-6, Jakarta", tlp: "021-50843888", kontak: "Ibu Kartika" }
    ];

    const kpActivities = [
        "Mempelajari alur proses bisnis perusahaan dan struktur divisi IT",
        "Melakukan setup environment dan instalasi tools pengembangan (VS Code, Git, Docker)",
        "Diberikan pengenalan mengenai arsitektur sistem internal perusahaan",
        "Mengikuti meeting mingguan sprint planning dengan tim developer",
        "Membuat desain mockup UI/UX untuk fitur manajemen karyawan",
        "Mengembangkan fitur login dan autentikasi menggunakan JWT",
        "Membuat REST API untuk mengambil data laporan penjualan bulan berjalan",
        "Membantu melakukan perbaikan (bug fixing) pada modul pencarian",
        "Melakukan testing fungsional (Blackbox Testing) pada aplikasi staging",
        "Membuat query database MySQL untuk mengoptimalkan waktu pencarian data",
        "Menyusun dokumentasi API menggunakan Swagger",
        "Membantu migrasi data dari sistem lama ke sistem baru",
        "Mempelajari dan mengimplementasikan framework ReactJS untuk dashboard",
        "Mendiskusikan progress aplikasi dengan pembimbing lapangan",
        "Menyusun draft laporan kerja praktik bab pendahuluan dan tinjauan pustaka",
        "Melakukan deployment aplikasi ke server staging perusahaan",
        "Melakukan presentasi hasil pengembangan modul di depan tim"
    ];

    console.log(`Found ${activePengajuan.length} Mahasiswa with APPROVED Pengajuan.`);

    let kpCount = 0;
    let logbookCount = 0;

    for (const pengajuan of activePengajuan) {
        // 1. Create or Update TempatKP
        const existingKp = await prisma.tempatKP.findFirst({
            where: { mahasiswaNim: pengajuan.mahasiswaNim }
        });

        const p = perusahaans[Math.floor(Math.random() * perusahaans.length)];

        if (!existingKp) {
            await prisma.tempatKP.create({
                data: {
                    mahasiswaNim: pengajuan.mahasiswaNim,
                    namaPerusahaan: p.nama,
                    alamatPerusahaan: p.alamat,
                    tlpFaxPerusahaan: p.tlp,
                    kontakPembimbing: p.kontak
                }
            });
            kpCount++;
        } else {
            // Update if empty
            await prisma.tempatKP.update({
                where: { id: existingKp.id },
                data: {
                    namaPerusahaan: p.nama,
                    alamatPerusahaan: p.alamat,
                    tlpFaxPerusahaan: p.tlp,
                    kontakPembimbing: p.kontak
                }
            });
            kpCount++;
        }

        // 2. Delete old inappropriate logbooks and recreate new KP ones
        await prisma.logbook.deleteMany({
            where: { mahasiswaNim: pengajuan.mahasiswaNim }
        });

        // Generate exactly 10-14 logs over the past 2 months
        const logsToCreate = Math.floor(Math.random() * 5) + 10;
        
        for (let i = 0; i < logsToCreate; i++) {
            const activity = kpActivities[Math.floor(Math.random() * kpActivities.length)];
            
            // Random date between 1 to 60 days ago
            const date = new Date();
            date.setDate(date.getDate() - (logsToCreate - i) * 3 - Math.floor(Math.random() * 2)); // Spread out sequentially roughly
            
            await prisma.logbook.create({
                data: {
                    mahasiswaNim: pengajuan.mahasiswaNim,
                    tanggalPukul: date,
                    uraian: activity,
                    catatan: i % 4 === 0 ? "Bagus, lanjutkan progresnya." : null,
                    pembimbingParaf: i < logsToCreate - 2 ? "APPROVED" : null // Simulate some have been approved
                }
            });
            logbookCount++;
        }
    }

    console.log(`Successfully assigned/updated ${kpCount} Tempat KP.`);
    console.log(`Successfully generated ${logbookCount} KP-specific logbook entries.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
