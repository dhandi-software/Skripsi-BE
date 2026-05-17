# 🎓 Portal Skripsi Universitas Pancasila - Backend API

Proyek ini adalah backend independent berbasis **Node.js, Express.js, Prisma ORM, PostgreSQL, dan Redis** yang melayani sistem portal skripsi, bimbingan, sidang, logbook, penilaian, serta sistem live chat *real-time*.

---

## 🚀 Panduan Menjalankan Sistem (How to Run)

### 🐳 Metode A: Menggunakan Docker Compose (Sangat Direkomendasikan)
Metode ini otomatis menyiapkan Node.js, PostgreSQL, Redis, dan melakukan sinkronisasi database dalam container terisolasi.

1.  **Siapkan `.env` di root folder:**
    Pastikan kredensial di `.env` Anda sudah benar (akan dibaca otomatis oleh Docker). Contoh `.env`:
    ```env
    DATABASE_URL="postgresql://postgres:password_db_anda@localhost:5432/Skripsi?schema=public"
    JWT_SECRET="your-secret-key-here"
    GEMINI_API_KEY="key anda"
    ```
2.  **Jalankan Docker Compose:**
    Ketik perintah berikut di terminal backend:
    ```bash
    docker compose up --build
    ```
3.  **Melakukan Seeding (Opsional):**
    Jika database kontainer baru Anda masih kosong dan ingin diisi data awal:
    ```bash
    docker compose exec app npm run seed
    ```

> [!WARNING]
> **Penting Jika Ganti Password/Kredensial Database:**
> Jika Anda mengalami error autentikasi database (`Authentication failed against database server`), hal itu terjadi karena volume penyimpanan database Docker lama Anda masih memakai password lama. 
> Jalankan perintah berikut untuk menghapus volume lama dan me-rebuild ulang secara bersih:
> ```bash
> docker compose down -v
> docker compose up --build
> ```

> [!TIP]
> **Hot-Reload di Windows (Volume & Polling):**
> Proyek ini menggunakan Docker Volume mounting (`./src:/app/src`) untuk mempermudah development. Di Windows, deteksi perubahan file (hot-reload) dari host ke dalam container seringkali terhambat oleh keterbatasan WSL filesystem bridge. 
> Untuk itu, kita telah menambahkan **`CHOKIDAR_USEPOLLING=true`** pada kontainer backend. Nodemon sekarang akan melakukan pemindaian berkala (*polling*) sehingga setiap kali Anda menyimpan file di dalam folder `src/`, server di dalam Docker akan langsung merespons dan melakukan restart secara otomatis!

---

### 💻 Metode B: Menjalankan Secara Lokal (Tanpa Docker)
Gunakan metode ini jika Anda ingin menjalankan service secara langsung di laptop Anda menggunakan Node.js lokal.

1.  **Install dependensi:**
    ```bash
    npm install
    ```
2.  **Generate Prisma Client:**
    ```bash
    npx prisma generate
    ```
3.  **Deploy skema database ke PostgreSQL lokal:**
    ```bash
    npx prisma migrate dev --name init_postgres
    ```
4.  **Jalankan seeding (data awal):**
    ```bash
    npm run seed
    ```
5.  **Jalankan server development:**
    ```bash
    npm run dev
    ```

---

## 🏛️ Perancangan Sistem (System Architecture)

Sistem ini menggunakan arsitektur **Three-Tier** yang membagi tanggung jawab secara modular:

```mermaid
graph TD
    subgraph Client Layer
        FE[React/Remix Client Application]
    end

    subgraph Service Layer
        BE[Express.js Server]
        SIO[Socket.io Server]
    end

    subgraph Storage Layer
        Prisma[Prisma ORM]
        DB[(PostgreSQL Database)]
        Redis[(Redis Cache / Broker)]
        FS[(Local File System - /uploads)]
    end

    FE -->|HTTP Requests| BE
    FE -->|WebSocket Protocol| SIO
    BE --> Prisma
    SIO --> Redis
    Prisma --> DB
    BE --> FS
```

### Penjelasan Komponen:
1.  **Client Layer**: Frontend berbasis React/Remix yang melakukan request API HTTP serta mendengarkan WebSocket events.
2.  **Service Layer**: Express.js sebagai pengolah REST API utama (routing, controller, business logic) dan Socket.IO sebagai engine web-sockets untuk menangani live chat realtime.
3.  **Storage Layer**:
    *   **PostgreSQL**: Menyimpan seluruh data user, bimbingan, sidang, logbook, dll.
    *   **Prisma ORM**: Sebagai jembatan interaksi database (aman dari SQL Injection).
    *   **File System**: Menyimpan file draft bimbingan dan media chat di folder `/uploads`.

---

## 📚 Spesifikasi API Utama (API Endpoints & Request Bodies)

Semua REST API menggunakan Base URL: `http://localhost:5002/api`

---

### 🔐 1. Autentikasi (`/auth`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query | Response (200 OK) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Semua (Public) | Login user & dapatkan JWT | `{ "username": "...", "password": "..." }` | `{ "token": "jwt...", "user": { "role": "..." } }` |
| **POST** | `/api/auth/change-password` | Semua | Mengganti password user | `{ "oldPassword": "...", "newPassword": "..." }` | `{ "message": "Password updated" }` |

---

### 📓 2. Logbook Harian (`/logbook`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/logbook/info` | Mahasiswa, Staf | Ambil info profil tempat magang | - |
| **POST** | `/api/logbook/info` | Mahasiswa | Simpan/update profil tempat magang | `{ "namaPerusahaan": "...", "tlpFaxPerusahaan": "...", "alamatPerusahaan": "..." }` |
| **GET** | `/api/logbook/entries` | Mahasiswa, Dosen, Staf | Ambil seluruh catatan harian logbook | - |
| **POST** | `/api/logbook/entries/sync` | Mahasiswa | Sinkronisasi/upsert massal logbook | `{ "entries": [ { "id": 1, "uraian": "Kegiatan...", "mahasiswaParaf": "base64..." } ] }` |

---

### 🎓 3. Bimbingan & Progres Tugas (`/bimbingan`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/bimbingan` | Mahasiswa, Dosen, Staf | Mendapatkan semua sesi bimbingan | - |
| **POST** | `/api/bimbingan` | Mahasiswa | Mengajukan sesi bimbingan baru / upload draf | `{ "mahasiswaId": 1, "dosenId": 2, "topik": "Bab 3", "catatan": "Draf..." }` |
| **GET** | `/api/bimbingan/mahasiswa/:id`| Mahasiswa, Dosen, Staf | Riwayat bimbingan per mahasiswa | - |
| **GET** | `/api/bimbingan/dosen-students` | Dosen, Staf | Daftar mahasiswa bimbingan yang telah di-ACC | `?search=<Nama/NIM>&status=<Filter>` *(Query)* |
| **POST** | `/api/bimbingan/assign-task` | Dosen | Memberikan target progres baru ke mahasiswa | `{ "mahasiswaId": 7, "topik": "Bab 1...", "jadwalBimbingan": "2026-05-20T10:00" }` |
| **PUT** | `/api/bimbingan/edit-task/:id` | Dosen | Mengedit target progres bimbingan aktif | `{ "topik": "Bab 2...", "jadwalBimbingan": "2026-05-25T14:00" }` |
| **GET** | `/api/bimbingan/mahasiswa-active-task`| Mahasiswa | Mendapatkan tugas bimbingan aktif | - |
| **PUT** | `/api/bimbingan/mark-as-read/:id` | Mahasiswa | Menandai revisi dosen sebagai "Sudah Dibaca" | - |
| **POST** | `/api/bimbingan/annotations` | Dosen | Menyimpan anotasi/coretan pada PDF draf | `{ "bimbinganId": 12, "page": 1, "x": 120.5, "y": 300.2, "content": "Perbaiki..." }` |
| **GET** | `/api/bimbingan/annotations/:bimbinganId` | Mahasiswa, Dosen | Mengambil semua anotasi pada draf PDF | - |

> [!NOTE]
> **Query Parameter `/api/bimbingan/dosen-students`:**
> - `search`: Pencarian *case-insensitive* ke field `mahasiswa.nama` atau `mahasiswa.nim`.
> - `status`: Opsi yang didukung: `"Belum Ditargetkan"`, `"Menunggu Reviu"`, `"Perlu Revisi"`, `"Sedang Dikerjakan"`, atau `"Semua"`.
> - Hasil otomatis diurutkan secara prioritas: **Belum Ditargetkan > Menunggu Reviu > Perlu Revisi > Sedang Dikerjakan**, disortir sekunder berdasarkan tanggal persetujuan judul terbaru.

---

### 📑 4. Peninjauan & Pengajuan Judul (`/pengajuan`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/pengajuan` | Mahasiswa | Mengajukan formulir judul skripsi baru | `{ "judul": "...", "peminatan": "...", "semester": "...", "tahunAkademik": "...", "sksDicapai": "...", "sksNilaiD": "...", "ipk": "...", "batasStudi": "...", "dosenId": 2 }` |
| **GET** | `/api/pengajuan/:id` | Mahasiswa, Dosen, Staf | Mengambil detail formulir pengajuan judul | - |
| **GET** | `/api/pengajuan/dosen/list` | Dosen | Mengambil daftar pengajuan masuk ke dosen ybs | - |
| **PUT** | `/api/pengajuan/:id/status` | Kaprodi, Dosen | Peninjauan formulir (Ubah status Setuju/Tolak) | `{ "status": "APPROVED", "remarks": "Relevan" }` *(Status: APPROVED, REJECTED, REVISION)* |
| **DELETE** | `/api/pengajuan/:id` | Mahasiswa | Membatalkan/menghapus pengajuan judul | - |
| **GET** | `/api/pengajuan/profile` | Mahasiswa | Mengambil profil mahasiswa aktif | - |
| **PUT** | `/api/pengajuan/profile` | Mahasiswa | Update foto & profil mahasiswa (Multipart) | `FormData: { nama: "...", photo: [File] }` |
| **PUT** | `/api/pengajuan/profile/dosen` | Dosen | Update foto & profil dosen (Multipart) | `FormData: { nama: "...", photo: [File] }` |
| **PUT** | `/api/pengajuan/profile/staf` | Staf | Update foto & profil staf (Multipart) | `FormData: { nama: "...", photo: [File] }` |

---

### 🏛️ 5. Manajemen Sidang Skripsi (`/sidang`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/sidang/apply` | Mahasiswa | Mahasiswa mengajukan jadwal sidang skripsi | `{ "mahasiswaId": 1, "judul": "...", "tanggalSidang": "2026-06-01", "waktuSidang": "10:00", "lokasi": "Ruang..." }` |
| **PUT** | `/api/sidang/approve/:id` | Dosen Pembimbing | Dosen Pembimbing memberikan persetujuan | - |
| **PUT** | `/api/sidang/approve-prodi/:id` | Kaprodi, Staf | Kaprodi/Staf memberikan persetujuan final | - |
| **PUT** | `/api/sidang/schedule/:id` | Staf | Staf memplot jadwal & dosen penguji | `{ "tanggalSidang": "2026-06-01", "waktuSidang": "10:00", "lokasi": "Ruang...", "pengujiId": 3 }` |
| **PUT** | `/api/sidang/verify-kaprodi/:id` | Kaprodi | Verifikasi berkas kelayakan oleh Kaprodi | - |
| **PUT** | `/api/sidang/confirm-jadwal-kaprodi/:id` | Kaprodi | Konfirmasi final jadwal oleh Kaprodi | - |
| **GET** | `/api/sidang/dosen` | Dosen | Mendapatkan daftar bimbingan sidang dosen | - |
| **GET** | `/api/sidang/mahasiswa` | Mahasiswa | Mengambil info & status sidang mahasiswa | - |
| **PUT** | `/api/sidang/mark-as-seen/:id` | Mahasiswa | Menandai notifikasi jadwal sidang dibaca | - |
| **DELETE** | `/api/sidang/:id` | Kaprodi, Staf | Menolak/menghapus pengajuan sidang | - |

---

### 📝 6. Penilaian Akhir (`/penilaian`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/penilaian` | Dosen | Menginput penilaian sidang (Penguji / Pembimbing) | `{ "mahasiswaId": 1, "dosenId": 2, "nilaiRataRata": 85.5, "keterangan": "Baik" }` |
| **GET** | `/api/penilaian/mahasiswa/:id`| Mahasiswa, Dosen, Staf | Melihat hasil penilaian akhir | - |

---

### 📢 7. Berita Acara & Pengumuman (`/acara`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/acara` | Mahasiswa, Dosen, Staf | Mendapatkan seluruh postingan berita acara | - |
| **GET** | `/api/acara/unread-count`| Mahasiswa | Mendapatkan jumlah pengumuman belum dibaca | - |
| **GET** | `/api/acara/:id` | Mahasiswa, Dosen, Staf | Mengambil detail berita acara spesifik | - |
| **POST** | `/api/acara` | Dosen, Staf | Membuat postingan berita acara baru | `{ "title": "Pengumuman...", "content": "...", "type": "ANNOUNCEMENT" }` *(ANNOUNCEMENT, TASK)* |
| **POST** | `/api/acara/upload` | Dosen, Staf | Upload lampiran berkas pengumuman (Multipart)| `FormData: { file: [File] }` |
| **PUT** | `/api/acara/:id` | Dosen, Staf | Memperbarui isi berita acara | `{ "title": "Revisi...", "content": "..." }` |
| **DELETE** | `/api/acara/:id` | Dosen, Staf | Menghapus pengumuman/berita acara | - |
| **POST** | `/api/acara/:id/read` | Mahasiswa | Menandai berita acara sebagai sudah dibaca | - |
| **POST** | `/api/acara/:id/comment` | Mahasiswa, Dosen, Staf | Memberikan komentar di kolom diskusi | `{ "content": "Terima kasih pak." }` |

---

### 💾 8. Unduh Materi & Template Dokumen (`/download`)

| Method | Endpoint | Aktor / Akses | Deskripsi | Request Body / Query |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/api/download` | Mahasiswa, Dosen, Staf | Mengambil list seluruh berkas materi | - |
| **GET** | `/api/download/:id` | Mahasiswa, Dosen, Staf | Mengambil detail berkas tertentu | - |
| **GET** | `/api/download/:id/download` | Mahasiswa, Dosen, Staf | Trigger download berkas (Sistem File Lokal) | - |
| **POST** | `/api/download` | Staf | Menyimpan metadata berkas baru | `{ "title": "...", "description": "...", "fileUrl": "..." }` |
| **POST** | `/api/download/upload` | Staf | Upload berkas fisik ke server (Multipart) | `FormData: { file: [File] }` |
| **PUT** | `/api/download/:id` | Staf | Mengupdate judul/deskripsi berkas materi | `{ "title": "...", "description": "..." }` |
| **DELETE** | `/api/download/:id` | Staf | Menghapus berkas materi secara permanen | - |

---

### 💬 9. Live Chat & Socket.IO (`/chat`)

Proses komunikasi real-time terintegrasi secara hibrida:

*   **REST API:**
    - `GET /api/chat/contacts/:userId` (Akses: Semua) - Mengambil list kontak & ringkasan pesan terakhir.
    - `GET /api/chat/history/:userId/:otherUserId` (Akses: Semua) - Mengambil riwayat pesan privat / publik (`public`).
    - `POST /api/chat/upload` (Akses: Semua) - Mengunggah berkas gambar/dokumen untuk lampiran chat.
*   **Socket.IO Events (Client -> Server):**
    - `join` (Akses: Semua) - Payload `{ userId: number }` (Join ke room chat personal).
    - `send_message` (Akses: Semua) - Payload `{ senderId: number, receiverId: number, content: string, attachmentUrl?: string }` (Kirim pesan baru).
    - `delete_message` (Akses: Semua) - Payload `{ messageId: number }` (Tarik pesan global / delete for everyone).


