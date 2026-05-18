const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateLecturer() {
  const userId = 9; // User for Dosen 2
  const targetMahasiswaId = 310;
  
  // getOwner simulation
  const dosen = await prisma.dosen.findUnique({
    where: { userId }
  });
  
  console.log("DOSEN:", dosen.id, dosen.nama);
  
  const bimbingan = await prisma.bimbingan.findFirst({
    where: {
      mahasiswaId: targetMahasiswaId,
      dosenId: dosen.id
    }
  });
  
  const pengajuan = await prisma.pengajuanJudul.findFirst({
    where: {
      mahasiswaId: targetMahasiswaId,
      dosenId: dosen.id,
      status: 'APPROVED'
    }
  });
  
  console.log("BIMBINGAN FOUND:", !!bimbingan);
  console.log("PENGAJUAN FOUND:", !!pengajuan);
  
  const logbooks = await prisma.logbook.findMany({
    where: { mahasiswaId: targetMahasiswaId }
  });
  
  console.log("LOGBOOKS FOUND:", logbooks.length);
}

simulateLecturer();
