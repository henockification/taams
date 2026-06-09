import { db } from '../../db';
import { user } from '../../schema';
import { eq } from 'drizzle-orm';

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

export async function getUserById(id: string): Promise<UserModel | null> {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  return result.length > 0 ? (result[0] as UserModel) : null;
}
