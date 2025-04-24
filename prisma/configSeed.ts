import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient();
async function seed() {
    await prisma.config.create({
        data: {
            name: 'isStorygraphEnabled',
            value: 'true'
        }
    });
    await prisma.config.create({
        data: {
            name: 'isGoodreadsEnabled',
            value: 'true'
        }
    });
    console.log("Config Table seeded");
}

seed().then(() => prisma.$disconnect()).catch(() => prisma.$disconnect())