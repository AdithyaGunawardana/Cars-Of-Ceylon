import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// Creates credential users with validated input and hashed passwords.
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  // Validate early and return structured field errors for clients.
  const parsed = registerSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid registration data",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json({ error: "Email is already registered" }, { status: 409 });
  }

  // Store only a password hash; plaintext passwords never touch persistence.
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
