const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const realisticKPTitles = [
  "Rancang Bangun Sistem Informasi Kepegawaian Berbasis Web",
  "Pengembangan Aplikasi Point of Sale (POS) pada Toko Retail",
  "Analisis dan Perancangan UI/UX Aplikasi E-Commerce",
  "Implementasi Sistem Manajemen Inventori Menggunakan React",
  "Pembuatan Dashboard Monitoring Kinerja Jaringan",
  "Pengembangan Modul Pelaporan Keuangan pada ERP",
  "Optimalisasi Database Server menggunakan PostgreSQL",
  "Rancang Bangun Sistem Presensi Mahasiswa Berbasis QR Code",
  "Membangun Aplikasi Manajemen Aset di Lingkungan Perusahaan",
  "Pembuatan API untuk Integrasi Layanan Pihak Ketiga",
  "Pengembangan Fitur Chatbot untuk Layanan Pelanggan",
  "Implementasi Keamanan Sistem Informasi Perusahaan",
  "Analisis Sentimen Pengguna pada Platform Media Sosial Perusahaan",
  "Pengembangan Sistem Informasi Manajemen Rumah Sakit (SIMRS)",
  "Rancang Bangun Aplikasi Mobile untuk Tenaga Sales di Lapangan"
];

const perusahaans = [
    { nama: "PT. Telkom Indonesia", alamat: "Jl. Ketintang No. 156, Surabaya", tlp: "031-8289456", kontak: "Budi Santoso (08123456789)" },
    { nama: "PT. PLN (Persero)", alamat: "Jl. Gemblongan No. 65, Surabaya", tlp: "031-5347261", kontak: "Andi Saputra (08213456789)" },
    { nama: "Diskominfo Jawa Timur", alamat: "Jl. Ahmad Yani No. 242, Surabaya", tlp: "031-8294608", kontak: "Rina Kusuma (08563456789)" },
    { nama: "PT. Bank Mandiri", alamat: "Jl. Pahlawan No. 120, Surabaya", tlp: "031-3532321", kontak: "Dian Wahyudi (08773456789)" },
    { nama: "PT. Gojek Indonesia", alamat: "Jl. Ngagel Jaya Selatan No. 16, Surabaya", tlp: "031-5034567", kontak: "Fajar Prasetyo (08983456789)" }
];

async function main() {
    console.log("Fixing PengajuanJudul and TempatKP...");
    const activePengajuan = await prisma.pengajuanJudul.findMany({
        where: { status: { in: ['APPROVED', 'DISETUJUI', 'SELESAI'] } },
        include: { mahasiswa: true }
    });

    let index = 0;
    for (const pengajuan of activePengajuan) {
        // Fix title if it contains "Sistem Cerdas" or similar weird generated text
        if (pengajuan.judul.includes("Sistem Cerdas") || pengajuan.judul.includes("Analisis Terhadap")) {
            const newTitle = realisticKPTitles[index % realisticKPTitles.length];
            await prisma.pengajuanJudul.update({
                where: { id: pengajuan.id },
                data: { judul: newTitle }
            });
        }
        index++;

        // Ensure TempatKP exists
        const existingKp = await prisma.tempatKP.findFirst({
            where: { mahasiswaNim: pengajuan.mahasiswaNim }
        });

        const p = perusahaans[index % perusahaans.length];
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
        }
    }

    console.log("Fixing Logbook Signatures...");
    const allLogbooks = await prisma.logbook.findMany({
        orderBy: { tanggalPukul: 'asc' }
    });
    
    // Group by NIM to approve the oldest ones
    const logbookByNim = {};
    for(const l of allLogbooks) {
        if(!logbookByNim[l.mahasiswaNim]) logbookByNim[l.mahasiswaNim] = [];
        logbookByNim[l.mahasiswaNim].push(l);
    }
    
    const validSignature = "https://dummyimage.com/150x50/ffffff/000000.png&text=Signed";

    for (const nim in logbookByNim) {
        const logs = logbookByNim[nim];
        const numToApprove = Math.floor(logs.length * 0.75); // Approve 75%
        for(let i=0; i<logs.length; i++) {
            if(i < numToApprove) {
                await prisma.logbook.update({
                    where: { id: logs[i].id },
                    data: {
                        mahasiswaParaf: validSignature,
                        pembimbingParaf: validSignature
                    }
                });
            } else {
                await prisma.logbook.update({
                    where: { id: logs[i].id },
                    data: {
                        mahasiswaParaf: null,
                        pembimbingParaf: null
                    }
                });
            }
        }
    }

    console.log("Done fixing DB.");
}

main().finally(() => prisma.$disconnect());
