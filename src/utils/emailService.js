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
            secure: port === 465,
            auth: { user, pass }
        });
    }
    return transporter;
}

/**
 * Send generic HTML Email Notification
 */
async function sendEmailNotification(to, subject, htmlContent) {
    if (!to || !to.includes('@')) {
        console.log(`[EMAIL SERVICE] Target email invalid: ${to}`);
        return false;
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const emailFrom = process.env.EMAIL_FROM || '"Portal Akademik UP" <teknikinformatikakerjapraktik@gmail.com>';

    const logoUrl = "https://i.pinimg.com/736x/06/22/bc/0622bca0fc32fe9df332c9354fcfc411.jpg";
    const logoHtml = `<img src="${logoUrl}" alt="Logo Universitas Pancasila" style="height:64px; width:auto; border-radius:8px; margin-bottom:8px; display:inline-block;" /><br/>`;

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
            .badge { display: inline-block; padding: 6px 14px; font-weight: 700; border-radius: 6px; font-size: 13px; margin-bottom: 14px; }
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

    if (!smtpUser || !smtpPass) {
        console.log(`\n📧 [EMAIL LOG] To: ${to} | Subject: ${subject}`);
        return true;
    }

    try {
        const mailOptions = {
            from: emailFrom,
            to: to,
            replyTo: 'teknikinformatikakerjapraktik@gmail.com',
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
 * 1. Notifikasi Proposal KP Disetujui Final oleh Dosen Pembimbing
 */
async function notifyJudulApproved(studentEmail, studentName, title, dosenName) {
    const subject = `[Proposal Disetujui] Pengajuan Judul KP/Skripsi - ${studentName}`;
    const html = `
        <span class="badge" style="background:#dcfce7; color:#15803d;">Proposal KP Disetujui</span>
        <h2>Selamat! Judul KP/Skripsi Anda Disetujui</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Pengajuan judul Kerja Praktik/Skripsi Anda telah resmi disetujui secara final oleh Dosen Pembimbing Anda.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #16a34a; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Judul Disetujui:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-style:italic;">"${title}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">Dosen Pembimbing:</p>
            <p style="margin:4px 0 0 0; color:#334155;">${dosenName}</p>
        </div>
        <p>Silakan buka portal untuk melihat lembar penugasan dan memulai aktivitas bimbingan.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Buka Portal KP</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * 2. Notifikasi Proposal KP Disetujui Koordinator & Diteruskan ke Pembimbing
 */
async function notifyPengajuanForwardedToDosen(studentEmail, studentName, title, dosenName) {
    const subject = `[Disetujui Koordinator] Pengajuan Judul KP - ${studentName}`;
    const html = `
        <span class="badge" style="background:#e0e7ff; color:#4338ca;">Persetujuan Koordinator</span>
        <h2>Pengajuan Judul KP Disetujui Koordinator</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Pengajuan judul Kerja Praktik Anda telah disetujui oleh Koordinator Prodi dan diteruskan ke Dosen Pembimbing.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #4f46e5; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Judul Usulan:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-style:italic;">"${title}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">Dosen Pembimbing Terpilih:</p>
            <p style="margin:4px 0 0 0; color:#334155;">${dosenName}</p>
        </div>
        <p>Saat ini usulan Anda sedang menunggu persetujuan akhir dari Dosen Pembimbing.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#4f46e5;">Pantau Status Pengajuan</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * 3. Notifikasi Penugasan Bimbingan Baru oleh Dosen Pembimbing
 */
async function notifyTaskAssigned(studentEmail, studentName, dosenName, topik, jadwalBimbingan) {
    const subject = `[Penugasan Bimbingan Baru] - ${topik}`;
    const jadwalStr = jadwalBimbingan ? new Date(jadwalBimbingan).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sesuai Kesepakatan';
    const html = `
        <span class="badge" style="background:#e0e7ff; color:#3730a3;">Penugasan Bimbingan</span>
        <h2>Penugasan Bimbingan Baru Dari Dosen Pembimbing</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Dosen Pembimbing Anda (<strong>${dosenName}</strong>) telah menetapkan tugas/topik bimbingan baru:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #4338ca; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">📌 Topik / Tugas Bimbingan:</p>
            <p style="margin:4px 0 12px 0; color:#1e1b4b; font-weight:700; font-size:15px;">"${topik}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">📅 Jadwal Bimbingan Target:</p>
            <p style="margin:4px 0 0 0; color:#3730a3; font-weight:600;">${jadwalStr}</p>
        </div>
        <p>Silakan siapkan draft laporan Anda dan unggah berkas melalui portal SIKP.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#4338ca;">Buka Lembar Bimbingan</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * 4. Notifikasi Draft Bimbingan Masuk (Dikirim dari Mahasiswa ke Dosen)
 */
async function notifyDraftUploaded(dosenEmail, dosenName, studentName, studentNim, topik, keteranganProgres) {
    const subject = `[Draft Bimbingan Masuk] ${studentName} (${studentNim})`;
    const html = `
        <span class="badge" style="background:#e0f2fe; color:#0369a1;">Draft Bimbingan Masuk</span>
        <h2>Berkas Draft Bimbingan Baru Diterima</h2>
        <p>Yth. <strong>${dosenName}</strong>,</p>
        <p>Mahasiswa bimbingan Anda (<strong>${studentName}</strong> - NIM ${studentNim}) telah mengunggah berkas/draft bimbingan baru:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #0284c7; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Topik Bimbingan:</p>
            <p style="margin:4px 0 12px 0; color:#0369a1; font-weight:700;">"${topik}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">📝 Keterangan / Catatan Mahasiswa:</p>
            <p style="margin:4px 0 0 0; color:#334155; font-style:italic;">"${keteranganProgres || 'Draft berkas bimbingan telah diunggah.'}"</p>
        </div>
        <p>Silakan buka portal untuk memeriksa berkas dan memberikan reviu/catatan bimbingan.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#0284c7;">Tinjau Draft Bimbingan</a>
    `;
    return await sendEmailNotification(dosenEmail, subject, html);
}

/**
 * 5. Notifikasi Hasil Reviu Bimbingan (Dikirim dari Dosen ke Mahasiswa)
 */
async function notifyBimbinganReviewed(studentEmail, studentName, dosenName, topik, status, catatan) {
    const subject = `[Hasil Reviu Bimbingan] - ${topik}`;
    const statusText = status === 'APPROVED' ? 'Disetujui' : 'Perlu Revisi';
    const badgeColor = status === 'APPROVED' ? 'background:#dcfce7; color:#15803d;' : 'background:#fef3c7; color:#b45309;';
    const borderColor = status === 'APPROVED' ? '#16a34a' : '#f59e0b';

    const html = `
        <span class="badge" style="${badgeColor}">Reviu Bimbingan: ${statusText}</span>
        <h2>Hasil Reviu Bimbingan dari ${dosenName}</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Dosen Pembimbing Anda telah memeriksa dan memberikan catatan reviu untuk topik: <strong>"${topik}"</strong>.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid ${borderColor}; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Topik Bimbingan:</p>
            <p style="margin:4px 0 12px 0; color:#1e293b; font-weight:700;">"${topik}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">💬 Catatan Reviu / Masukan Dosen:</p>
            <p style="margin:4px 0 0 0; color:#334155; font-weight:600;">"${catatan || 'Silakan periksa lembar bimbingan di portal.'}"</p>
        </div>
        <p>Silakan buka portal untuk membaca detail catatan dan mengunduh berkas reviu.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#FF7A00;">Lihat Catatan Reviu</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * Notifikasi Penjadwalan Sidang
 */
async function notifySidangScheduled(studentEmail, studentName, dateStr, location, dosenNames) {
    const subject = `[Jadwal Resmi] Sidang KP/Skripsi - ${studentName}`;
    const html = `
        <span class="badge" style="background:#f0fdf4; color:#15803d;">Jadwal Sidang Resmi</span>
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
        <span class="badge" style="background:#e0e7ff; color:#3730a3;">Akun Portal KP</span>
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
 * Notifikasi Pesan Chat / Lampiran Dokumen Baru (Dinamis)
 */
async function notifyNewChatMessage(recipientEmail, recipientName, senderName, messageText, options = {}) {
    const isAttachment = options.isAttachment || messageText.toLowerCase().includes("lampiran") || messageText.toLowerCase().includes("file");
    const category = options.category || (isAttachment ? "Lampiran Dokumen" : "Pesan Chat");

    const subject = `[${category} Baru] dari ${senderName} - Portal KP Universitas Pancasila`;
    const previewMessage = messageText.length > 150 ? messageText.substring(0, 150) + "..." : messageText;
    const badgeText = `${category} Masuk`;
    const badgeBg = isAttachment ? "#f0fdf4" : "#eff6ff";
    const badgeColor = isAttachment ? "#15803d" : "#1d4ed8";
    const borderColor = isAttachment ? "#22c55e" : "#0284c7";
    const btnText = isAttachment ? "Buka Lampiran Dokumen" : "Buka Pesan Chat";

    const html = `
        <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:700;">${badgeText}</span>
        <h2>Halo, ${recipientName}!</h2>
        <p>Anda menerima ${category.toLowerCase()} baru dari <strong>${senderName}</strong> pada sistem portal Kerja Praktik:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid ${borderColor}; border-radius:6px; margin:16px 0; font-style:italic;">
            "${previewMessage}"
        </div>
        <p>Silakan buka portal untuk melihat ${category.toLowerCase()} secara langsung.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">${btnText}</a>
    `;
    return await sendEmailNotification(recipientEmail, subject, html);
}

/**
 * Notifikasi Bimbingan / Logbook (Dynamic Fallback)
 */
async function notifyBimbinganOrLogbook(recipientEmail, recipientName, title, details, options = {}) {
    const badgeText = options.badgeText || "Aktivitas Bimbingan";
    const badgeBg = options.badgeBg || "#fef3c7";
    const badgeColor = options.badgeColor || "#b45309";
    const subjectPrefix = options.subjectPrefix || "[Bimbingan KP]";

    const subject = `${subjectPrefix} ${title}`;
    const html = `
        <span class="badge" style="background:${badgeBg}; color:${badgeColor};">${badgeText}</span>
        <h2>Halo, ${recipientName}!</h2>
        <p>Ada pembaruan pada aktivitas bimbingan Anda:</p>
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
    const subject = `[Batas Waktu] Pengingat Deadline ${typeName} - ${studentName}`;
    
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

/**
 * Notifikasi Catatan Revisi Pengajuan Judul / Formulir KP oleh Dosen Pembimbing / Koordinator
 */
async function notifyPengajuanRevision(studentEmail, studentName, title, dosenName, remarks, deadlineStr = null) {
    const subject = `[Revisi Proposal KP] Catatan Perbaikan - ${studentName}`;
    const deadlineHtml = deadlineStr ? `
        <div style="background:#fff7ed; border:1px solid #ffedd5; border-radius:8px; padding:12px; margin-top:12px;">
            <p style="margin:0; font-size:13px; font-weight:700; color:#c2410c;">⏰ Batas Waktu Revisi:</p>
            <p style="margin:2px 0 0 0; font-size:14px; font-weight:600; color:#9a3412;">${deadlineStr}</p>
        </div>
    ` : '';

    const html = `
        <span class="badge" style="background:#fef3c7; color:#b45309;">Revisi Proposal KP</span>
        <h2>Catatan Revisi Pengajuan Judul KP/Skripsi</h2>
        <p>Yth. <strong>${studentName}</strong>,</p>
        <p>Pengajuan formulir / judul Kerja Praktik Anda memerlukan perbaikan / revisi dari <strong>${dosenName}</strong>.</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #f59e0b; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Judul Pengajuan:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-style:italic;">"${title}"</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">📝 Catatan / Masukan Revisi Dosen:</p>
            <p style="margin:4px 0 0 0; color:#b45309; font-weight:600;">"${remarks || 'Silakan periksa kembali berkas dan formulir pengajuan Anda di portal.'}"</p>
            ${deadlineHtml}
        </div>
        <p>Silakan segera melakukan perbaikan dan mengunggah kembali formulir pengajuan Anda di portal.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#f59e0b;">Perbaiki Pengajuan Sekarang</a>
    `;
    return await sendEmailNotification(studentEmail, subject, html);
}

/**
 * Notifikasi Dosen saat Usulan Judul Diteruskan oleh Koordinator
 */
async function notifyDosenPengajuanForwarded(dosenEmail, dosenName, studentName, title) {
    const subject = `[Penugasan Judul Baru] ${studentName} - Portal KP Universitas Pancasila`;
    const html = `
        <span class="badge" style="background:#e0e7ff; color:#3730a3;">Penugasan Usulan Judul</span>
        <h2>Usulan Judul Diteruskan Kepada Anda</h2>
        <p>Yth. <strong>${dosenName}</strong>,</p>
        <p>Koordinator KP/Skripsi telah menyetujui dan meneruskan pengajuan judul mahasiswa bimbingan Anda:</p>
        <div style="background:#f8fafc; padding:16px; border-left:4px solid #4338ca; border-radius:6px; margin:16px 0;">
            <p style="margin:0; font-weight:600; color:#0f172a;">Mahasiswa:</p>
            <p style="margin:4px 0 12px 0; color:#334155; font-weight:700;">${studentName}</p>
            <p style="margin:0; font-weight:600; color:#0f172a;">Judul Usulan:</p>
            <p style="margin:4px 0 0 0; color:#3730a3; font-style:italic;">"${title}"</p>
        </div>
        <p>Silakan buka portal SIKP untuk memberikan persetujuan atau catatan revisi.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn" style="background:#4338ca;">Tinjau Pengajuan Judul</a>
    `;
    return await sendEmailNotification(dosenEmail, subject, html);
}

/**
 * Notifikasi Pengumuman & Acara Baru
 */
async function notifyNewAcara(recipientEmail, recipientName, senderName, title, content, type = "ANNOUNCEMENT") {
    const isAssignment = type === "ASSIGNMENT";
    const categoryName = isAssignment ? "Instruksi / Berita Acara" : "Pengumuman";
    const badgeText = isAssignment ? "Instruksi Baru" : "Pengumuman Baru";
    const badgeBg = isAssignment ? "#fef3c7" : "#eff6ff";
    const badgeColor = isAssignment ? "#b45309" : "#1d4ed8";
    const borderColor = isAssignment ? "#f59e0b" : "#0284c7";

    const subject = `[${categoryName}] ${title} - Portal KP Universitas Pancasila`;
    
    // Strip HTML tags for clean email preview
    const cleanContent = content ? content.replace(/<[^>]*>?/gm, '').trim() : "";
    const previewMessage = cleanContent.length > 200 ? cleanContent.substring(0, 200) + "..." : cleanContent;

    const html = `
        <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:700;">${badgeText}</span>
        <h2>Halo, ${recipientName}!</h2>
        <p><strong>${senderName}</strong> telah menerbitkan ${categoryName.toLowerCase()} baru pada portal Kerja Praktik:</p>
        <div style="background:#f8fafc; padding:18px; border-left:4px solid ${borderColor}; border-radius:8px; margin:16px 0;">
            <h3 style="margin:0 0 8px 0; color:#0f172a; font-size:16px;">${title}</h3>
            <p style="margin:0; color:#334155; font-size:14px; line-height:1.6;">${previewMessage || "Silakan lihat detail pengumuman pada portal."}</p>
        </div>
        <p>Silakan buka portal untuk membaca pengumuman dan instruksi selengkapnya.</p>
        <a href="https://kp.daffathan-labs.my.id/login" class="btn">Lihat Pengumuman</a>
    `;
    return await sendEmailNotification(recipientEmail, subject, html);
}

module.exports = {
    sendEmailNotification,
    notifyJudulApproved,
    notifyPengajuanForwardedToDosen,
    notifyDosenPengajuanForwarded,
    notifyTaskAssigned,
    notifyDraftUploaded,
    notifyBimbinganReviewed,
    notifySidangScheduled,
    notifyAccountCreated,
    notifyNewChatMessage,
    notifyBimbinganOrLogbook,
    notifyDeadlineWarning,
    notifyPengajuanRevision,
    notifyNewAcara
};
