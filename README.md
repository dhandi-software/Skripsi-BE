# Skripsi Backend API Documentation

Documentation for the independent Node.js Backend service for Skripsi application.

## 🔐 Authentication Routes
Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate user | `{ "username": "string", "password": "password" }` | `{ "token": "jwt...", "user": { "role": "..." } }` |

## 👥 User Roles
Currently using database users. Default password for migrated users: **`DhandiAdam`** (or as configured in `.env`).

| Role | Username |
| :--- | :--- |
| **Kaprodi** | `kaprodi` |
| **Dosen Pembimbing** | `dospem` |
| **Staf Universitas** | `staf` |
| **Mahasiswa** | `mahasiswa` |

## 🚀 How to Run
```bash
# Install dependencies
npm install

# Run database migration (if schema changes)
npx prisma migrate dev --name init_postgres

# Run development server
npm run dev
```

---

## 📚 Skripsi Backend API Documentation (Extended)

### 🛠️ Migration Commands
Perintah migrasi digunakan untuk menyinkronkan perubahan skema (`schema.prisma`) ke database asli.

**Command:**
```bash
npx prisma migrate dev --name <nama_migrasi>
```
**Penjelasan `nama_migrasi`:**
`--name` adalah **label/catatan** untuk riwayat perubahan yang Anda lakukan. Ini seperti memberi judul pada bab buku agar kita tahu apa yang berubah di titik itu.
- Contoh: `npx prisma migrate dev --name init` (Inisialisasi awal)
- Contoh: `npx prisma migrate dev --name tambah_tabel_nilai` (Jika nanti menambah tabel nilai)

### 📝 Penilaian (Assessment) API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/penilaian` | Get all assessment data | - |
| **POST** | `/api/penilaian` | Create new assessment | `{ "mahasiswaId": 1, "dosenId": 2, "nilai": 85, "keterangan": "Bagus" }` |
| **GET** | `/api/penilaian/mahasiswa/:id` | Get assessments by Mahasiswa ID | - |

### 🎓 Bimbingan (Guidance) API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/bimbingan` | Get all guidance sessions | - |
| **POST** | `/api/bimbingan` | Create new guidance session | `{ "mahasiswaId": 1, "dosenId": 2, "topik": "Bab 1", "catatan": "Revisi latar belakang", "status": "PENDING" }` |
| **GET** | `/api/bimbingan/mahasiswa/:id` | Get guidance sessions by Mahasiswa ID | - |
