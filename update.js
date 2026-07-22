const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.sidang.update({
        where: { id: 13 },
        data: {
            status: 'MENUNGGU_PERSETUJUAN_PEMBIMBING',
            pembimbingApproved: false
        }
    });
    console.log("Updated successfully");
}

main().finally(() => prisma.$disconnect());
