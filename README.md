# Skripsi Backend API Documentation

Documentation for the independent Node.js Backend service for Skripsi application.

## 🔐 Authentication Routes
Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | Authenticate user | `{ "username": "string", "password": "password" }` | `{ "token": "jwt...", "user": { "role": "..." } }` |

## 👥 User Roles (Mock Data)
Currently using mock data with default password: **`password`**

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

# Run development server
npm run dev
```
