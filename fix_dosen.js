const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const realisticDosenNames = [
    "Dr. Ir. Budi Santoso, M.T.",
    "Dr. Rina Kusuma, S.Kom., M.Cs.",
    "Andi Saputra, S.T., M.Kom.",
    "Dian Wahyudi, S.Kom., M.Eng.",
    "Fajar Prasetyo, S.T., M.T.",
    "Siti Nurhaliza, S.Kom., M.IT.",
    "Dr. Eko Susilo, M.T.",
    "Rudi Hermawan, S.Kom., M.Kom.",
    "Dr. Anita Rachman, S.T., M.T.",
    "Hendrik Setiawan, S.Kom., M.Cs."
];

async function main() {
    console.log("Fixing Dosen names...");
    const dosens = await prisma.dosen.findMany();
    
    let index = 0;
    for (const d of dosens) {
        if (d.nama.includes("Dosen Pembimbing") || d.nama.includes("Dosen Penguji")) {
            await prisma.dosen.update({
                where: { nidn: d.nidn },
                data: { nama: realisticDosenNames[index % realisticDosenNames.length] }
            });
            index++;
        }
    }
    console.log("Done fixing Dosen.");
}
main().finally(() => prisma.$disconnect());
