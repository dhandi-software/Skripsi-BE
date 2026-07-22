const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const id = 13;
        const isRejected = true;
        const catatan = "Revisi Bab 3";
        
        const currentSidang = await prisma.sidang.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentSidang) {
            console.log("Data sidang tidak ditemukan.");
            return;
        }

        if (isRejected) {
             const sidang = await prisma.sidang.update({
                 where: { id: parseInt(id) },
                 data: {
                     status: 'DITOLAK',
                     catatan: catatan || null,
                     mahasiswaSeen: false
                 }
             });
             console.log(sidang);
             return;
        }
    } catch (error) {
        console.error(error);
    }
}

main().finally(() => prisma.$disconnect());
