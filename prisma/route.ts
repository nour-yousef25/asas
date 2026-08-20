import { NextResponse } from 'next/server';
import {
  getOrganizationSettings,
  updateOrganizationAppearance,
} from '@/modules/settings/organization';

/**
 * GET /api/settings/organization
 * Retrieves the current organization's settings.
 */
export async function GET() {
  try {
    const settings = await getOrganizationSettings();
    if (!settings) {
      return NextResponse.json({ message: 'Organization settings not found.' }, { status: 404 });
    }
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/settings/organization
 * Updates the organization's appearance settings.
 */
export async function PUT(request: Request) {
  try {
    const organization = await getOrganizationSettings();
    if (!organization) {
      return NextResponse.json({ message: 'Organization not found.' }, { status: 404 });
    }
    const data = await request.json();
    const updatedSettings = await updateOrganizationAppearance(organization.id, data);
    return NextResponse.json(updatedSettings);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}