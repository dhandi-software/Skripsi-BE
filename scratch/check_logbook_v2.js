const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const logbooks = await prisma.logbook.findMany({
      take: 20
    });
    console.log("LOGBOOKS:", JSON.stringify(logbooks, null, 2));
    
    const students = await prisma.mahasiswa.findMany({
      take: 10,
      include: {
        bimbingan: true,
        pengajuanJudul: true
      }
    });
    console.log("STUDENTS:", JSON.stringify(students.map(s => ({
      id: s.id,
      nama: s.nama,
      nim: s.nim,
      supervisorBimbingan: s.bimbingan.map(b => b.dosenId),
      supervisorPengajuan: s.pengajuanJudul.map(p => p.dosenId)
    })), null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
