# Skripsi Backend API Documentation

Documentation for the independent Node.js Backend service for Skripsi application.

### 💬 Live Chat API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/chat/upload` | Upload attachment | `FormData: { file: File }` |
| **GET** | `/api/chat/history/:userId/:otherUserId` | Get chat history | - |
| **GET** | `/api/chat/contacts/:userId` | Get contacts with last message | - |

### 🔌 Socket.IO Events
| Event Name | Direction | Description |
| :--- | :--- | :--- |
| `join` | Client -> Server | Join user room |
| `send_message` | Client -> Server | Send new message |
| `delete_message` | Client -> Server | Delete for everyone |
| `delete_message_for_me` | Client -> Server | Delete for me |

## 📚 API Documentation (Extended)

Dokumentasi detail lainnya dapat dilihat di: **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

## 🔐 Authentication Routes
Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate user | `{ "username": "string", "password": "password" }` | `{ "token": "jwt...", "user": { "role": "..." } }` |
| **POST** | `/api/auth/change-password` | Change user password | `{ "oldPassword": "...", "newPassword": "..." }` | `{ "message": "..." }` |

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

# Run database seeding
npm run seed
```

---

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

### 🏛️ Sidang (Defense Scheduling) API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/sidang/apply` | Apply for sidang (Staff/Dosen/Student) | `{ "mahasiswaId": 1, "judul": "...", "tanggalSidang": "...", "waktuSidang": "...", "lokasi": "..." }` |
| **PUT** | `/api/sidang/:id/schedule` | Update defense schedule (Staff/Prodi) | `{ "tanggalSidang": "...", "waktuSidang": "...", "lokasi": "...", "pengujiId": 2 }` |
| **PUT** | `/api/sidang/:id/approve-pembimbing` | ACC from Supervisor | - |
| **PUT** | `/api/sidang/:id/approve-prodi` | Final ACC from Prodi | - |
| **GET** | `/api/sidang` | Get all defense records | - |

### 👮 Admin API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/admin/create-mahasiswa` | Create new Mahasiswa account | `{ "email": "...", "password": "...", "nama": "...", "nim": "...", "jurusan": "...", "tahunMasuk": "..." }` |
| **POST** | `/api/admin/create-mahasiswa-massal` | Bulk create accounts from array | `{ "users": [{...}] }` |
| **POST** | `/api/admin/create-dosen` | Create new Dosen account | `{ "email": "...", "password": "...", "nama": "...", "nidn": "...", "jabatan": "..." }` |
| **POST** | `/api/admin/create-staf` | Create new Staf account | `{ "email": "...", "password": "...", "nama": "..." }` |
| **PUT** | `/api/admin/users/:id` | Update user account | `{ "email": "...", "name": "...", "role": "...", "nim": "...", "nidn": "...", "jurusan": "...", "tahunMasuk": "...", "jabatan": "..." }` |
| **DELETE** | `/api/admin/users/:id` | Delete user account | - |
| **GET** | `/api/admin/users-role?role=...` | Get list of users by role | - |
| **GET** | `/api/admin/monitoring` | Get monitoring dashboard data | - |

### 📑 Pengajuan (Title Proposal) & Profile API

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/pengajuan/profile/staf` | Get Staff Profile | - |
| **PUT** | `/api/pengajuan/profile/staf` | Update Staff Profile (Name, Email, Photo) | `FormData: { nama: "...", email: "...", photo: File }` |
| **PUT** | `/api/pengajuan/:id/status` | Update proposal status | `{ "status": "APPROVED/REJECTED/REVISION", "remarks": "..." }` |

### 📓 Logbook API
Base URL: `/api/logbook`

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/logbook/info` | Get Company Profile for Logbook | - |
| **POST** | `/api/logbook/info` | Update Company Profile | `{ "namaPerusahaan": "...", "tlpFaxPerusahaan": "...", "alamatPerusahaan": "..." }` |
| **GET** | `/api/logbook/entries` | Get all logbook entries (ordered ASC) | - |
| **POST** | `/api/logbook/entries/sync` | Sync/Upsert multiple entries | `{ "entries": [ { "id": "...", "tanggalPukul": "...", "uraian": "...", "mahasiswaParaf": "base64...", "pembimbingParaf": "base64...", "catatan": "..." } ] }` |

> **Note**: For `sync`, if `id` is > 1.000.000.000.000 (timestamp), it's treated as a new entry. Otherwise, it updates existing by ID.
