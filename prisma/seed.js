const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt'); // Keeping for now if needed, but using static hash

const prisma = new PrismaClient();

async function main() {
  // Hash for 'password123'
  const passwordHash = '$2y$10$JitvuaG///Wr4waoPurrWuFcsM5dxaY/58KJ5Bz01cnQ/2ds1o3oq';

  // 1. Kaprodi
  await prisma.user.upsert({
    where: { username: 'kaprodi' },
    update: {},
    create: {
      username: 'kaprodi',
      email: 'kaprodi@univ.ac.id',
      password: passwordHash,
      role: 'kaprodi',
      dosen: {
        create: {
            nip: '198001012005011001',
            nama: 'Dr. Kaprodi, S.Kom, M.Kom',
            jabatan: 'Kepala Program Studi'
        }
      }
    },
  });

  // 2. Dosen Pembimbing
  await prisma.user.upsert({
    where: { username: 'dosen' },
    update: {},
    create: {
      username: 'dosen',
      email: 'dosen@univ.ac.id',
      password: passwordHash,
      role: 'dosen',
      dosen: {
        create: {
            nip: '198505052010011002',
            nama: 'Ir. Dosen Pembimbing, M.T',
            jabatan: 'Lektor'
        }
      }
    },
  });

  // 3. Staf
  await prisma.user.upsert({
    where: { username: 'staf' },
    update: {},
    create: {
      username: 'staf',
      email: 'staf@univ.ac.id',
      password: passwordHash,
      role: 'staf',
    },
  });

  // 4. Mahasiswa
  await prisma.user.upsert({
    where: { username: 'mahasiswa' },
    update: {},
    create: {
      username: 'mahasiswa',
      email: 'mahasiswa@student.univ.ac.id',
      password: passwordHash,
      role: 'mahasiswa',
      mahasiswa: {
        create: {
            nim: '4519210001',
            nama: 'Mahasiswa Berprestasi',
            jurusan: 'Teknik Informatika'
        }
      }
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
