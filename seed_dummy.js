const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting seed...');

    // Cleanup previous data
    console.log("Cleaning up previous dummy data...");
    
    // Cleanup previous data
    console.log("Cleaning up previous dummy data (protecting APPROVED/non-PENDING records)...");
    
    const protectedPengajuans = await prisma.pengajuanJudul.findMany({
        where: {
            status: { not: "PENDING" },
            OR: [
                { mahasiswaNim: { startsWith: "2024000" } },
                { mahasiswaNim: { startsWith: "45" } }
            ]
        },
        select: { mahasiswaNim: true }
    });
    const protectedNims = protectedPengajuans.map(p => p.mahasiswaNim);

    await prisma.pengajuanJudul.deleteMany({
        where: {
            mahasiswaNim: { notIn: protectedNims },
            OR: [
                { mahasiswaNim: { startsWith: "2024000" } },
                { mahasiswaNim: { startsWith: "45" } }
            ]
        }
    });

    const oldMahasiswa = await prisma.mahasiswa.findMany({
        where: {
            nim: { notIn: protectedNims },
            OR: [
                { nim: { startsWith: "2024000" } },
                { nim: { startsWith: "45" } }
            ]
        }
    });

    for (const m of oldMahasiswa) {
        try {
            await prisma.mahasiswa.delete({ where: { nim: m.nim } });
            await prisma.chatRoomMember.deleteMany({ where: { userId: m.userId } });
            await prisma.message.deleteMany({ where: { senderId: m.userId } });
            await prisma.message.deleteMany({ where: { receiverId: m.userId } });
            await prisma.user.delete({ where: { id: m.userId } });
        } catch (e) {
            console.log(`Could not fully delete user ${m.userId}:`, e.meta?.field_name || e.message);
        }
    }

    const firstNames = [
        "Budi", "Andi", "Ahmad", "Rizky", "Dimas", "Ilham", "Fajar", "Reza", "Dika", "Wahyu",
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

    const peminatans = [
        "Data Science",
        "Artificial Intelligence",
        "Software Engineering",
        "Network and Cyber Security"
    ];

    const allTitles = {
        "Data Science": [
            "Analisis Prediktif Data Penjualan Menggunakan Machine Learning",
            "Implementasi Big Data untuk Menganalisis Pola Pembelian Konsumen",
            "Pengembangan Model Klasifikasi untuk Deteksi Dini Penyakit",
            "Prediksi Churn Pelanggan Telekomunikasi Menggunakan Random Forest",
            "Segmentasi Pelanggan Menggunakan Algoritma K-Means Clustering",
            "Analisis Sentimen Ulasan Produk Menggunakan Support Vector Machine",
            "Sistem Rekomendasi Film Berbasis Collaborative Filtering",
            "Prediksi Harga Saham Menggunakan Long Short-Term Memory (LSTM)",
            "Penerapan Data Mining untuk Penentuan Strategi Promosi",
            "Deteksi Fraud pada Transaksi Keuangan dengan Algoritma XGBoost"
        ],
        "Artificial Intelligence": [
            "Sistem Pakar Diagnosa Penyakit Menggunakan Metode Forward Chaining",
            "Pengenalan Wajah Secara Real-Time Menggunakan CNN",
            "Chatbot Pelayanan Pelanggan Berbasis NLP",
            "Deteksi Objek pada Lalu Lintas Menggunakan YOLOv8",
            "Sistem Cerdas Pendeteksi Hama Tanaman Berbasis Computer Vision",
            "Pengenalan Suara untuk Sistem Keamanan Rumah Pintar",
            "Klasifikasi Dokumen Otomatis Berbasis Naive Bayes",
            "Robotika Berbasis Penglihatan untuk Pemilahan Barang Otomatis",
            "Analisis Teks Berita Palsu Menggunakan Deep Learning",
            "Penerapan Reinforcement Learning pada Game Catur"
        ],
        "Software Engineering": [
            "Pengembangan Aplikasi E-Commerce Berbasis Microservices",
            "Rancang Bangun Sistem Informasi Manajemen Rumah Sakit",
            "Otomatisasi Pengujian Perangkat Lunak Menggunakan Selenium",
            "Sistem Informasi Akademik Sekolah Berbasis Web",
            "Aplikasi Mobile Pencatatan Keuangan Pribadi Berbasis Flutter",
            "Pengembangan Sistem Manajemen Proyek dengan Pendekatan Agile",
            "Rancang Bangun Aplikasi Booking Tiket Online",
            "Integrasi Payment Gateway pada Aplikasi E-Commerce",
            "Pengembangan Sistem Absensi Karyawan Berbasis Geolocation",
            "Audit Keamanan Kode pada Aplikasi Perbankan"
        ],
        "Network and Cyber Security": [
            "Analisis Kerentanan Jaringan Menggunakan Metode Penetration Testing",
            "Implementasi Sistem Deteksi Intrusi (IDS) pada Jaringan Kampus",
            "Keamanan Data Medis Menggunakan Algoritma Kriptografi AES",
            "Analisis Forensik Digital pada Bukti Serangan Malware",
            "Rancang Bangun VPN Server untuk Keamanan Komunikasi Perusahaan",
            "Mitigasi Serangan DDoS Menggunakan Software Defined Network (SDN)",
            "Audit Keamanan Sistem Informasi Berdasarkan Standar ISO 27001",
            "Implementasi Honeypot untuk Deteksi Ancaman Jaringan",
            "Keamanan Aplikasi Web Menggunakan Web Application Firewall (WAF)",
            "Pengujian Celah Keamanan Aplikasi Mobile Menggunakan OWASP",
            "Keamanan Jaringan Komputer Menggunakan Honeypot (V2)",
            "Analisis Forensik Digital pada Smartphone (V2)",
            "Uji Penetrasi Jaringan Nirkabel (V2)"
        ],
        "Cyber Security": [ // Fallback
            "Keamanan Jaringan Komputer Menggunakan Honeypot",
            "Analisis Forensik Digital pada Smartphone",
            "Uji Penetrasi Jaringan Nirkabel"
        ]
    };

    // 1. Fetch available Dosen
    const allDosens = await prisma.dosen.findMany();
    if (allDosens.length === 0) {
        console.log('No dosen found. Please create some dosen first.');
        return;
    }

    // Filter dosen to only pembimbing or koordinator
    const targetDosens = allDosens.filter(d => {
        const jab = (d.jabatan || '').toLowerCase();
        return jab.includes('pembimbing') || jab.includes('koordinator');
    });

    if (targetDosens.length === 0) {
        console.log('No Dosen with jabatan Pembimbing or Koordinator found. Using all dosen instead.');
        targetDosens.push(...allDosens);
    }

    const passwordHash = await bcrypt.hash('password123', 10);
    
    let globalStudentCounter = 1;

    for (const dosen of targetDosens) {
        console.log(`\nGenerating 20 Mahasiswa for Dosen: ${dosen.nama}`);
        
        let dosenPeminatans = Array.isArray(dosen.peminatan) ? dosen.peminatan : [];
        if (dosenPeminatans.length === 0) {
            dosenPeminatans = peminatans; // If dosen has no peminatan, use all available to pick randomly
        }

        for (let i = 0; i < 20; i++) {
            // Pick a peminatan for this student from the dosen's peminatan array
            let peminatan = dosenPeminatans[i % dosenPeminatans.length];
            if (peminatan === "Cyber Security") peminatan = "Network and Cyber Security";
            
            // Randomize 3rd and 4th digit up to 25 (e.g. 18 to 25)
            const randomAngka = Math.floor(Math.random() * (25 - 18 + 1)) + 18; 
            const nimIndex = globalStudentCounter.toString().padStart(4, '0');
            const nim = `45${randomAngka}21${nimIndex}`;
            
            // Generate Name
            const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const nama = `${fName} ${lName}`;
            
            const safeName = (fName + lName).toLowerCase().replace(/[^a-z0-9]/g, '');
            const email = `${safeName}${nimIndex}@student.univ.ac.id`;
            const username = email;

            const user = await prisma.user.create({
                data: {
                    username: username,
                    password: passwordHash,
                    role: 'mahasiswa',
                }
            });

            const mahasiswa = await prisma.mahasiswa.create({
                data: {
                    nim: nim,
                    userId: user.id,
                    nama: nama,
                    tahunMasuk: '20' + randomAngka, 
                    email: email,
                }
            });
            
            const titlesForPeminatan = allTitles[peminatan] || allTitles["Data Science"];
            const baseJudul = titlesForPeminatan[Math.floor(Math.random() * titlesForPeminatan.length)];
            // Adding a small random unique suffix so it doesn't collide or look completely identical
            const judul = `${baseJudul} (Studi Kasus ${Math.floor(Math.random() * 1000)})`;

            await prisma.pengajuanJudul.create({
                data: {
                    mahasiswaNim: mahasiswa.nim,
                    dosenNidn: dosen.nidn,
                    judul: judul,
                    peminatan: peminatan,
                    semester: '7',
                    tahunAkademik: '2025/2026',
                    sksDicapai: '120',
                    sksNilaiD: '0',
                    ipk: (3.2 + Math.random() * 0.7).toFixed(2),
                    batasStudi: (2000 + randomAngka + 6).toString(), 
                    status: 'PENDING'
                }
            });

            console.log(`  -> Created Mahasiswa: ${nama} (${nim}) [Peminatan: ${peminatan}]`);
            globalStudentCounter++;
        }
    }

    console.log(`\nSeeding finished successfully. Total generated students: ${globalStudentCounter - 1}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
