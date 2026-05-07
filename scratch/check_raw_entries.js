const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEntries() {
  try {
    const logbooks = await prisma.$queryRaw`SELECT * FROM "Logbook" LIMIT 10`;
    console.log("LOGBOOKS RAW:", JSON.stringify(logbooks, null, 2));
    
    const students = await prisma.$queryRaw`SELECT id, nama, nim FROM "Mahasiswa" LIMIT 5`;
    console.log("STUDENTS RAW:", JSON.stringify(students, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkEntries();
