import { PrismaClient } from "@prisma/client";
import { RenewalForm } from "../_components/renewal-form";

const prisma = new PrismaClient();

async function getMembers() {
  return prisma.member.findMany({
    include: {
      user: true,
    },
    orderBy: {
      user: {
        name: "asc",
      },
    },
  });
}

export default async function RenewMembershipPage() {
  const members = await getMembers();
  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <RenewalForm members={members} />
    </main>
  );
}