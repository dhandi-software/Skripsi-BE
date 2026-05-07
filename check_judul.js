const prisma = require('./src/prisma');

async function main() {
  console.log('--- Checking PengajuanJudul Data ---');
  const allPengajuan = await prisma.pengajuanJudul.findMany({
    include: { mahasiswa: true }
  });
  console.log(`Found ${allPengajuan.length} total pengajuan judul records.`);
  allPengajuan.forEach(p => {
    console.log(`- Student: ${p.mahasiswa.nama}, Status: ${p.status}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
