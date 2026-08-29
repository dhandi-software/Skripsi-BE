const nodemailer = require('nodemailer');

// Single instance for email transporter
let transporter = null;

function getTransporter() {
    if (!transporter) {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '465');
        const user = process.env.SMTP_USER || '';
        const pass = process.env.SMTP_PASS || '';

        transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass
            }
        });
    }
    return transporter;
}

/**
 * Send generic HTML Email Notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Body HTML content
 */
async function sendEmailNotification(to, subject, htmlContent) {
    if (!to || !to.includes('@')) {
        console.log(`[EMAIL SERVICE] Target email invalid: ${to}`);
        return false;
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const path = require('path');
    const fs = require('fs');

    const emailFrom = process.env.EMAIL_FROM || '"Portal Akademik UP" <akademik@univpancasila.ac.id>';

    // Base64 Logo Inline Setup (No attachment chip in Gmail)
    const logoPath = path.join(__dirname, '../../uploads/logo_up.png');
    let logoHtml = '';
    if (fs.existsSync(logoPath)) {
        const base64Data = fs.readFileSync(logoPath).toString('base64');
        logoHtml = `<img src="data:image/png;base64,${base64Data}" alt="Logo Universitas Pancasila" style="height:64px; width:auto; margin-bottom:8px; display:inline-block;" /><br/>`;
    }

    // Beautiful HTML Wrapper
    const formattedHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
            .container { max-width: 600px; background: #ffffff; margin: 0 auto; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
            .header { background: #003366; color: #ffffff; padding: 24px; text-align: center; }
            .header h1 { margin: 6px 0 0 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
            .content { padding: 30px; color: #333333; line-height: 1.6; }
            .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
            .badge { display: inline-block; padding: 6px 12px; background: #eff6ff; color: #1d4ed8; font-weight: 600; border-radius: 6px; font-size: 13px; margin-bottom: 12px; }
            .btn { display: inline-block; background: #FF7A00; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 700; margin-top: 16px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                ${logoHtml}
                <h1>UNIVERSITAS PANCASILA</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Sistem Informasi Kerja Praktik & Skripsi</p>
            </div>
            <div class="content">
                ${htmlContent}
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Fakultas Teknik Universitas Pancasila. All rights reserved.<br>
                Email ini dikirimkan secara otomatis oleh sistem, mohon tidak membalas email ini.
            </div>
        </div>
    </body>
    </html>
    `;

    // Dev Mode or Missing App Password fallback
    if (!smtpUser || !smtpPass) {
        console.log(`\n📧 [EMAIL SIMULASI / LOG]`);
        console.log(`   Kepada  : ${to}`);
        console.log(`   Subjek  : ${subject}`);
        console.log(`   Status  : Ready untuk terkirim asli jika SMTP_PASS diisi di .env\n`);
        return true;
    }

    try {
        const mailOptions = {
            from: emailFrom,
            to: to,
            subject: subject,
            html: formattedHtml
        };

        const info = await getTransporter().sendMail(mailOptions);
        console.log(`✅ [EMAIL TERKIRIM] To: ${to} | MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ [EMAIL ERROR] Gagal mengirim ke ${to}:`, error.message);
        return false;
    }
}

/**
 * Notifikasi Pengajuan Judul KP Disetujui
 */
async function notifyJudulApproved(studentEmail, studentName, title, dosenName) {
    const subject = `[Disetujui] Pengajuan Judul KP/Skripsi - ${studentName}`;
    const html = `
        <span class="badge">Status Pengajuan: Disetujui</span>
        <h2>Selamat! Judul KP/Skripsi Anda Disetujui</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Pengajuan judul Kerja Praktik/Skripsi Anda telah resmi disetujui oleh Koordinator Program Studi.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #003366; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Judul Disetujui:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-style:italic;">"${title}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">Dosen Pembimbing:</p>
            <p style="margin:4px 0 0 0; color:#334155;">${dosenName}</p>
        </div>
        <p>Silakan segera menghubungi Dosen Pembimbing Anda untuk memulai proses bimbingan.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Buka Portal KP</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * Notifikasi Penjadwalan Sidang
 */
async function notifySidangScheduled(studentEmail, studentName, dateStr, location, dosenNames) {
    const subject = `[Jadwal Resmi] Sidang KP/Skripsi - ${studentName}`;
    const html = `
        <span class="badge" style="background:#f0fdf4; color:#15803d;">Status Sidang: Dijadwalkan</span>
        <h2>Yth. ${studentName},</h2>
        <p>Jadwal pelaksanaan Sidang Kerja Praktik/Skripsi Anda telah resmi ditetapkan oleh Koordinator KP.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #FF7A00; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">📅 Waktu Sidang:</p>
            <p style="margin:4px 0 12px 0; color:#334155;">${dateStr}</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">📍 Lokasi / Ruangan:</p>
            <p style="margin:4px 0 12px 0; color:#1e293b; font-weight:700;">${location}</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">👨‍🏫 Penguji & Pembimbing:</p>
            <p style="margin:4px 0 0 0; color:#334155;">${dosenNames}</p>
        </div>
        <p>Harap mengonfirmasi dan hadir 15 menit sebelum pelaksanaan sidang dimulai.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Lihat Rincian Sidang</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * Notifikasi Pembuatan Akun Baru
 */
async function notifyAccountCreated(userEmail, name, role, rawPassword) {
    const subject = `[Akun Resmi] Pendaftaran Akun Portal KP Universitas Pancasila`;
    const html = `
        <h2>Selamat Datang, ${name}!</h2>
        <p>Akun portal Kerja Praktik & Skripsi Universitas Pancasila Anda telah berhasil dibuat sebagai <strong>${role}</strong>.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #003366; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Email Login:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-family:monospace; font-size:15px;">${userEmail}</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">Password Default:</p>
            <p style="margin:4px 0 0 0; color:#334155; font-family:monospace; font-size:15px;">${rawPassword}</p>
        </div>
        <p>Demi keamanan, harap segera mengganti kata sandi Anda setelah berhasil masuk.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Login Sekarang</a>
    `;
    return await sendEmailNotification(userEmail, subject, html);
}

/**
 * Notifikasi Pesan Chat Baru
 */
async function notifyNewChatMessage(recipientEmail, recipientName, senderName, messageText) {
    const subject = `[Pesan Baru] dari ${senderName} - Portal KP Universitas Pancasila`;
    const previewMessage = messageText.length > 150 ? messageText.substring(0, 150) + "..." : messageText;
    const html = `
        <span class="badge" style="background:#eff6ff; color:#1d4ed8;">Chat Masuk</span>
        <h2>Halo, ${recipientName}!</h2>
        <p>Anda menerima pesan baru dari <strong>${senderName}</strong> pada sistem portal Kerja Praktik:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #0284c7; border-radius:6px; margin:16px 0; font-style:italic;">
            "${previewMessage}"
        </div>
        <p>Silakan buka portal untuk membalas pesan secara langsung.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Buka Pesan Chat</a>
    `;
    return await sendEmailNotification(recipientEmail, subject, html);
}

/**
 * Notifikasi Bimbingan / Logbook Baru
 */
async function notifyBimbinganOrLogbook(recipientEmail, recipientName, title, details) {
    const subject = `[Update Bimbingan/Logbook] - ${title}`;
    const html = `
        <span class="badge" style="background:#fef3c7; color:#b45309;">Bimbingan & Logbook</span>
        <h2>Halo, ${recipientName}!</h2>
        <p>Ada pembaruan pada aktivitas bimbingan / logbook Anda:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #f59e0b; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">${title}</p>
            <p style="margin:4px 0 0 0; color:#334155;">${details}</p>
        </div>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Lihat Detail Bimbingan</a>
    `;
    return await sendEmailNotification(recipientEmail, subject, html);
}

/**
 * Notifikasi Pengingat Batas Waktu / Deadline Dinamis berdasarkan Program & Aktivitas
 */
async function notifyDeadlineWarning(studentEmail, studentName, eventType, title, deadlineStr, documentsList = []) {
    const typeName = eventType || "Jadwal Akademik";
    const subject = `[Deadline] Pengingat Batas Waktu ${typeName} - ${studentName}`;
    
    // Default document/requirements list based on program type
    let docs = documentsList;
    if (!docs || docs.length === 0) {
        if (typeName.toLowerCase().includes("bimbingan")) {
            docs = [
                "Draft Bab Laporan Bimbingan KP/Skripsi",
                "Catatan revisi & masukan dari Dosen Pembimbing",
                "Logbook aktivitas bimbingan harian"
            ];
        } else if (typeName.toLowerCase().includes("sidang")) {
            docs = [
                "Laporan KP/Skripsi final yang telah disetujui Dosen Pembimbing",
                "Formulir persetujuan pendaftaran sidang",
                "Transkrip nilai SKS kumulatif (minimal 100 SKS)"
            ];
        } else {
            docs = [
                "Laporan Kerja Praktik (PDF, maks. 10 MB)",
                "Lembar penilaian perusahaan (ditandatangani & distempel)",
                "Surat keterangan selesai KP",
                "Logbook harian (minimal 30 hari kerja)"
            ];
        }
    }
    
    const html = `
        <span class="badge" style="background:#fee2e2; color:#dc2626;">Deadline ${typeName}</span>
        <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:12px; padding:18px; margin:16px 0;">
            <p style="margin:0; font-size:16px; font-weight:700; color:#c2410c;">
                ⚠️ Pengingat Batas Waktu ${typeName}
            </p>
            <p style="margin:4px 0 0 0; font-size:15px; font-weight:600; color:#9a3412;">
                ${deadlineStr}
            </p>
        </div>
        <p style="color:#334155; font-size:15px; line-height:1.6;">
            Yth. <strong>${studentName}</strong>,<br/>
            Batas akhir pengumpulan <strong>${title || typeName}</strong> melalui portal SIKP adalah <span style="color:#dc2626; font-weight:700;">${deadlineStr}</span>.
        </p>
        <p style="font-weight:600; margin-top:20px; color:#0f172a;">Dokumen / Berkas yang wajib diunggah:</p>
        <ul style="margin:8px 0; padding-left:20px; color:#334155; line-height:1.8;">
            ${docs.map(item => `<li>${item}</li>`).join('')}
        </ul>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#dc2626;">Unggah Berkas Sekarang</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

module.exports = {
    sendEmailNotification,
    notifyJudulApproved,
    notifySidangScheduled,
    notifyAccountCreated,
    notifyNewChatMessage,
    notifyBimbinganOrLogbook,
    notifyDeadlineWarning
};
