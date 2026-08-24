import { PrismaClient } from "@prisma/client";
import { W02_PERMISSION_CATALOG } from "../src/lib/permission-catalog";

const prisma = new PrismaClient();

async function main() {
  for (const [name, module, action] of W02_PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { name },
      update: { module, action },
      create: { name, module, action, description: `W02 semantic permission: ${name}` },
    });
  }
  process.stdout.write(JSON.stringify({ status: "PASS_PRODUCTION_PERMISSION_CATALOG", permissionCount: W02_PERMISSION_CATALOG.length, demoUsersCreated: false, demoOrganizationsCreated: false }) + "\n");
}

void main().catch(() => {
  process.stderr.write("Production permission catalog initialization failed.\n");
  process.exitCode = 2;
}).finally(async () => prisma.$disconnect());
