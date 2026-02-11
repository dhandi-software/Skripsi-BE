const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    const email = "adminunivpancasila@univ.ac.id";
    const password = "password123";

    console.log(`Seeding admin user: ${email}...`);

    // Check if exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log("Admin user already exists.");
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            username: "admin_univ",
            email: email,
            password: hashedPassword,
            role: "ADMIN",
        },
    });

    console.log("Admin user created:", user);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
