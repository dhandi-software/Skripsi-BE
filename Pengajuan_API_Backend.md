# 📝 Dokumentasi API Backend: Pengajuan Formulir

Dokumen ini menjelaskan spesifikasi Endpoint yang dimiliki Backend, dan alur proses dari penerimaan request hingga masuk ke Database.

## 📊 Tabel Spesifikasi Endpoint (API Contract)

| Properti | Penjelasan / Nilai |
| :--- | :--- |
| **Method** | `POST` |
| **Endpoint URL Utama** | `/api/pengajuan` |
| **Fungsi Endpoint** | Menerima dan memvalidasi usulan judul skripsi baru |
| **Autentikasi (Header)** | `Authorization: Bearer <token_jwt_mahasiswa>` |
| **Request Body** | JSON (Sesuai dengan tabel payload Frontend) |
| **Response Sukses (201)** | `{"message": "Pengajuan successful", "data": {...}}` |
| **Response Gagal (400)** | `{"message": "Invalid or missing Dosen ID"}` |
| **Response Gagal (403)** | `{"message": "Dosen Reguler tidak dapat dipilih..."}` |

---

## 🚀 Step-by-Step Cara Backend Bekerja

### Step 1: Menangkap Request di Router (Pintu Masuk)
Backend (Express.js) akan mendengarkan request masuk yang ditembak oleh *Fetch* Frontend (`client.post`) pada file `pengajuanRoutes.js`.
```javascript
// Middleware authenticateToken bertugas mengecek siapa mahasiswa yang mengirim form ini
router.post('/', authenticateToken, pengajuanController.createPengajuan);
```

### Step 2: Ekstrak Data di Controller
Di file `pengajuanController.js`, JSON yang dikirim dari Frontend terbungkus di dalam `req.body`.
```javascript
exports.createPengajuan = async (req, res) => {
    // Membongkar (Ekstrak) JSON menjadi variabel-variabel satuan
    const {
        judul, dosenId, peminatan, semester, 
        tahunAkademik, sksDicapai, sksNilaiD, ipk, batasStudi
    } = req.body; 
```

### Step 3: Pengecekan / Validasi Database
Sebelum di-save, backend mencari data Mahasiswa asli berdasarkan Token Login (`req.user.id`) untuk memastikan datanya valid dan aman.
```javascript
const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: req.user.id }
});

if (!mahasiswa) return res.status(404).json({ message: "Profil tidak ditemukan" });
```

### Step 4: Menyimpan ke Database (Prisma ORM)
Variabel yang sudah diekstrak pada Step 2 kemudian di-mapping dan dieksekusi masuk ke tabel `PengajuanJudul` di PostgreSQL.
```javascript
    const pengajuan = await prisma.pengajuanJudul.create({
        data: {
            mahasiswaNim: mahasiswa.nim,
            dosenNidn: dosenId, 
            judul: judul,              
            peminatan: peminatan,          
            semester: String(semester),
            tahunAkademik: tahunAkademik,
            sksDicapai: String(sksDicapai),
            sksNilaiD: String(sksNilaiD),
            ipk: String(ipk),
            batasStudi: batasStudi,
            status: 'PENDING_KOORDINATOR' // Status default otomatis
        }
    });
```

### Step 5: Memberikan Balasan (Response) ke Frontend
Setelah data tersimpan di DB, Backend **wajib** membalas request dari Frontend agar aplikasi Frontend tahu prosesnya selesai (supaya Loading-nya berhenti).
```javascript
    // Balas dengan status HTTP 201 (Tanda Data Baru Berhasil Dibuat)
    res.status(201).json({ message: "Pengajuan successful", data: pengajuan });
};
```
