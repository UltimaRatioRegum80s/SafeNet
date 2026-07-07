import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { users } from '@shared/schema';
import type { SignupData, LoginData, AnonJoinData, User } from '@shared/schema';

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(data: SignupData): Promise<User> {
  if (!data.password) {
    throw new Error('Password is required');
  }
  
  const passwordHash = await hashPassword(data.password);
  const roles = data.role === 'private' ? ['resident'] : ['security_org'];
  
  const [user] = await db.insert(users).values({
    email: data.email,
    passwordHash,
    username: data.username,
    roles,
    country: data.country,
    city: data.city,
  }).returning();

  return user;
}

export async function createAnonymousUser(data: AnonJoinData): Promise<User> {
  // Check if email already exists (if email is provided)
  if (data.email) {
    const existingUser = await findUserByEmail(data.email);
    if (existingUser) {
      throw new Error('An account with this email address already exists. Please try logging in instead.');
    }
  }
  
  // Check if username already exists
  const existingUsername = await findUserByUsername(data.username);
  if (existingUsername) {
    throw new Error('This username is already taken. Please choose a different one.');
  }
  
  const roles = data.role === 'private' ? ['resident'] : ['security_org'];
  
  const [user] = await db.insert(users).values({
    username: data.username,
    email: data.email || null,
    roles,
    country: data.country,
    city: data.city,
  }).returning();

  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user || null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.username, username));
  return user || null;
}

export async function validateLogin(email: string, password: string): Promise<User | null> {
  if (!email || !password) {
    return null;
  }
  
  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user || !user.passwordHash) {
    return null;
  }
  
  try {
    const isValid = await verifyPassword(password, user.passwordHash);
    return isValid ? user : null;
  } catch (error) {
    console.error('Password verification error:', error);
    return null;
  }
}