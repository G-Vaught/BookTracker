import { prisma } from "./prisma"

export const resetAllUsers = async () => {
    await prisma.book.deleteMany();
    await prisma.user.updateMany({
        data: {
            isFirstLookup: true
        }
    });
}