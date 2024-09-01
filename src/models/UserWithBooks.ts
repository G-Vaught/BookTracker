import { Prisma } from '@prisma/client';

export type UserWithBook = Prisma.UserGetPayload<{
	include: {
		books: true;
	};
}>;
