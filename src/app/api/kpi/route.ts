import { NextRequest, NextResponse } from "next/server";
import { kpiSchema, kpiRecordSchema } from "@/lib/validations";
import { requireTenantContext } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/policy";
import { memberKpiRepository } from "@/lib/member-kpi-repository";

export async function GET() {
  const context = await requireTenantContext();
  await requirePermission(context, "kpi.read");
  return NextResponse.json(await memberKpiRepository.listKpis(context));
}

export async function POST(req: NextRequest) {
  const context = await requireTenantContext();
  await requirePermission(context, "kpi.create");
  const kpi = await memberKpiRepository.createKpi(context, kpiSchema.parse(await req.json()));
  return NextResponse.json(kpi, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const context = await requireTenantContext();
  await requirePermission(context, "kpi.update");
  const record = await memberKpiRepository.addKpiRecord(context, kpiRecordSchema.parse(await req.json()));
  return NextResponse.json(record, { status: 201 });
}
