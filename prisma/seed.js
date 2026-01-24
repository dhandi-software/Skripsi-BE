const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password', 10);

  // 1. Kaprodi
  await prisma.user.upsert({
    where: { username: 'kaprodi' },
    update: {},
    create: {
      username: 'kaprodi',
      email: 'kaprodi@univ.ac.id',
      password: password,
      role: 'KAPRODI',
      // Assuming Kaprodi is also a lecturer, we can add Dosen profile if needed, 
      // but for now let's stick to the base role or ask if they need specific profile data.
      // Usually Kaprodi has a Dosen profile. Let's add it to be safe if the schema allows nulls or we want it.
      // Checking schema previously, Dosen is optional relation on User, but Dosen model requires userId.
      // Let's create Dosen profile for Kaprodi too.
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
      password: password,
      role: 'DOSEN',
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
      password: password,
      role: 'STAF',
    },
  });

  // 4. Mahasiswa
  await prisma.user.upsert({
    where: { username: 'mahasiswa' },
    update: {},
    create: {
      username: 'mahasiswa',
      email: 'mahasiswa@student.univ.ac.id',
      password: password,
      role: 'MAHASISWA',
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
