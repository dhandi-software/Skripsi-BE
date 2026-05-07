const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const logbooks = await prisma.logbook.findMany({
    take: 10,
    include: {
      mahasiswa: true,
      dosen: true
    }
  });
  console.log(JSON.stringify(logbooks, null, 2));
  
  const logbookInfos = await prisma.logbookInfo.findMany({
    take: 10
  });
  console.log(JSON.stringify(logbookInfos, null, 2));
}

checkData();
