const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Hash for 'password123'
  const passwordHash = '$2b$10$tHD3fD1GY5EPyDqWNRI8CeBVc3W/QHPCu.Nh1ljd4r7irmrZawKmK';

  console.log('Starting seeding Admin account...');

  // 1. Create Admin User
  // ----------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { username: 'adminunivpancasila' },
    update: { password: passwordHash, role: 'admin' },
    create: {
      username: 'adminunivpancasila',
      email: 'adminunivpancasila@univ.ac.id',
      password: passwordHash,
      role: 'admin'
    },
  });

  console.log('✓ Admin account seeded successfully.');
  console.log('All seeding tasks finished successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
