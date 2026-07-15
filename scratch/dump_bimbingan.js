const prisma = require('../src/prisma');

async function main() {
    const students = await prisma.mahasiswa.findMany({
        include: {
            bimbingan: true
        }
    });
    console.log(JSON.stringify(students, null, 2));
}

main().catch(err => {
    console.error(err);
}).finally(() => {
    process.exit(0);
});
