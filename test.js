const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.mahasiswa.findFirst({ include: { user: true } }).then(res => console.log(JSON.stringify(res, null, 2))).finally(() => prisma.$disconnect());
