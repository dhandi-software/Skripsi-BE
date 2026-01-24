# 📚 Backend API Documentation

Documentation for **Skripsi-Be**, serving as the backend for the Universitas Pancasila Portal.

## Base URL
`http://localhost:5000/api`

## 🔐 Authentication
**Prefix**: `/auth`

### Login
- **Endpoint**: `POST /login`
- **Description**: Authenticate user and return token.
- **Body**:
  ```json
  {
    "username": "user123",
    "password": "password123"
  }
  ```
- **Response**:
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "username": "user123",
      "role": "mahasiswa"
    }
  }
  ```

---

## 💬 Live Chat System
**Prefix**: `/chat`

### Upload Attachment
- **Endpoint**: `POST /upload`
- **Description**: Upload file (image/document) for chat attachment.
- **Body**: `multipart/form-data` with field `file`.
- **Response**:
  ```json
  {
    "url": "/uploads/filename.png",
    "type": "image/png"
  }
  ```

### Get Chat History
- **Endpoint**: `GET /history/:userId/:otherUserId`
- **Description**: Retrieve message history between two users. Use `public` as `otherUserId` for public room.
- **Response**: Array of message objects.

### Get Contacts
- **Endpoint**: `GET /contacts/:userId`
- **Description**: Get list of available contacts with last message preview.
- **Response**:
  ```json
  {
    "users": [...], 
    "lastPublicMessage": {...}
  }
  ```

---

## 📝 Bimbingan (Guidance)
**Prefix**: `/bimbingan`

### Get All Bimbingan
- **Endpoint**: `GET /`
- **Description**: Retrieve all guidance records.

### Create Bimbingan
- **Endpoint**: `POST /`
- **Description**: Submit new guidance record.
- **Body**:
  ```json
  {
    "mahasiswaId": 1,
    "dosenId": 2,
    "topik": "Research Topic",
    "catatan": "Notes..."
  }
  ```

### Get Bimbingan by Mahasiswa
- **Endpoint**: `GET /mahasiswa/:mahasiswaId`
- **Description**: Get guidance history for specific student.

---

## 📊 Penilaian (Grading)
**Prefix**: `/penilaian`

### Get All Penilaian
- **Endpoint**: `GET /`
- **Description**: Retrieve all grades.

### Create Penilaian
- **Endpoint**: `POST /`
- **Description**: Grade a student.
- **Body**:
  ```json
  {
    "mahasiswaId": 1,
    "dosenId": 2,
    "nilai": 85.5,
    "keterangan": "Excellent"
  }
  ```

### Get Penilaian by Mahasiswa
- **Endpoint**: `GET /mahasiswa/:mahasiswaId`
- **Description**: Get grades for specific student.

---

## 🔌 Socket.IO Events

### Client -> Server
- `join`: Join user specific room.
- `send_message`: Send new message.
- `mark_read`: Mark messages as read.
- `delete_message`: Globally delete message (retract).
- `delete_message_for_me`: Locally hide message for self.

### Server -> Client
- `receive_message`: Incoming new message.
- `message_sent`: Confirmation of sent message (for sync).
- `messages_read`: Read receipt update.
- `message_deleted`: Message retracted globally.
- `message_deleted_for_me`: Confirmation of local delete.
