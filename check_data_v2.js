const prisma = require('./src/prisma');

async function main() {
  console.log('--- Checking Bimbingan Data ---');
  const allBimbingan = await prisma.bimbingan.findMany({
    include: { mahasiswa: true }
  });
  console.log(`Found ${allBimbingan.length} total bimbingan records.`);
  
  const bimbinganBab5 = allBimbingan.filter(b => 
    b.status === 'APPROVED' && 
    (b.topik.toLowerCase().includes('bab 5') || b.topik.toLowerCase().includes('bab v'))
  );
  
  console.log(`Found ${bimbinganBab5.length} bimbingan records that are APPROVED and contain "Bab 5/V".`);
  if (bimbinganBab5.length > 0) {
    bimbinganBab5.forEach(b => {
      console.log(`- Student: ${b.mahasiswa.nama}, Topic: ${b.topik}, Status: ${b.status}`);
    });
  }

  console.log('\n--- Checking Sidang Data ---');
  const allSidang = await prisma.sidang.findMany({
    include: { mahasiswa: true }
  });
  console.log(`Found ${allSidang.length} existing sidang records.`);
  allSidang.forEach(s => {
    console.log(`- Student: ${s.mahasiswa.nama}, Status: ${s.status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
