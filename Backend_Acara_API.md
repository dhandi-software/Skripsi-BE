# Dokumentasi API - Fitur Acara (Berita Acara)

Service ini menangani pengelolaan tugas, pengumuman, dan berita acara dari dosen ke mahasiswa.

## Autentikasi
Semua endpoint memerlukan Header:
`Authorization: Bearer <token>`

---

## 1. Get Acara
**Endpoint:** `GET /acara`
**Fungsi:** Mendapatkan semua postingan berita acara.
**Logic:**
- Jika Mahasiswa: Menyertakan field `isRead: boolean`.
- Jika Dosen/Admin: Mendapatkan list lengkap.

---

## 2. Get Unread Count (Khusus Mahasiswa)
**Endpoint:** `GET /acara/unread-count`
**Fungsi:** Mendapatkan jumlah postingan yang belum diklik/dibaca oleh mahasiswa.
**Response:**
```json
{ "count": 5 }
```

---

## 3. Mark As Read (Khusus Mahasiswa)
**Endpoint:** `POST /acara/:id/read`
**Fungsi:** Menandai postingan tertentu sebagai 'sudah dibaca'.
**Logic:** Digunakan untuk menghilangkan badge notifikasi dan status "Baru" pada item.

---

## 4. Create Acara (Dosen/Admin)
**Endpoint:** `POST /acara`
**Body:**
```json
{
  "title": "Judul Postingan",
  "content": "<p>Isi postingan (HTML)</p>",
  "type": "ASSIGNMENT" | "ANNOUNCEMENT"
}
```

---

## 5. Add Comment
**Endpoint:** `POST /acara/:id/comment`
**Body:**
```json
{ "content": "Konten komentar" }
```

---

## 6. Upload Media
**Endpoint:** `POST /acara/upload`
**Form-Data:** `file: <binary>`
**Fungsi:** Mengunggah gambar atau dokumen untuk dimasukkan ke editor.
