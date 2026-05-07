const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Logbook'
    `;
    console.log("COLUMNS IN Logbook:", JSON.stringify(result, null, 2));
    
    const resultInfo = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'LogbookInfo'
    `;
    console.log("COLUMNS IN LogbookInfo:", JSON.stringify(resultInfo, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
