import { db } from '../../db';
import { user } from '../../schema';
import { count, ilike, or } from 'drizzle-orm';

type UserModel = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean | null;
  role: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  image: string | null;
};

export async function getAllUsersPaginated({
  page = 1,
  pageSize = 20,
  search = '',
}: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ users: UserModel[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize;
  const normalizedSearch = search.trim();
  const whereClause = normalizedSearch
    ? or(
        ilike(user.name, `%${normalizedSearch}%`),
        ilike(user.email, `%${normalizedSearch}%`),
      )
    : undefined;

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(user)
    .where(whereClause);

  // Get paginated users
  const users = await db
    .select()
    .from(user)
    .where(whereClause)
    .orderBy(user.createdAt)
    .limit(pageSize)
    .offset(offset);

  return {
    users: users as UserModel[],
    total: Number(totalCount),
    page,
    pageSize,
  };
}
