import { eq } from "drizzle-orm";
import { db } from "../../db";
import { user } from "../../schema";

// Generic function to update any user field(s)
export async function updateUserById(
    userId: string, 
    updateData: {
        name?: string;
        email?: string;
        emailVerified?: boolean;
        image?: string;
        role?: string[];
        tenantId?: string;
    }
) {
    const result = await db
        .update(user)
        .set({ 
            ...updateData,
            updatedAt: new Date() // Always update the timestamp
        })
        .where(eq(user.id, userId));
    
    return result;
}

// Specific function to update user profile image
export async function updateUserProfileImage(userId: string, imageUrl: string) {
    return updateUserById(userId, { image: imageUrl });
}

// Specific function to update user name
export async function updateUserName(userId: string, name: string) {
    return updateUserById(userId, { name });
}

// Specific function to update user email
export async function updateUserEmail(userId: string, email: string) {
    return updateUserById(userId, { email });
}