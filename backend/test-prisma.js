const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing findMany...');
        const sales = await prisma.sale.findMany({
            take: 1
        });
        console.log('Success:', sales);
    } catch (e) {
        console.error('Error caught in script:');
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
