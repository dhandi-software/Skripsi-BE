const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      dosen: true
    },
    take: 20
  });
  
  console.log(JSON.stringify(users.map(u => ({
    username: u.username,
    role: u.role,
    jabatan: u.dosen?.jabatan
  })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
