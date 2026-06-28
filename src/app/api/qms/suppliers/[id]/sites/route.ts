import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import {
  findSupplierById,
  findSitesBySupplier,
  createSite,
} from '@/lib/qms/repositories/supplier.repo';

async function getCtx(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: p } = await supabaseAdmin
    .from('auth_profiles').select('org_id, data').eq('id', user.id).single();
  if (!p) return null;
  return {
    userId: user.id,
    orgId: p.org_id as string,
    userRole: (p.data as Record<string, unknown>)?.role as string,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canViewQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const supplier = await findSupplierById(id);
    if (!supplier || supplier.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const sites = await findSitesBySupplier(id);
    return NextResponse.json(sites);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canManageQms(ctx.userRole)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const supplier = await findSupplierById(id);
    if (!supplier || supplier.org_id !== ctx.orgId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json() as {
      name: string;
      address?: Record<string, string>;
      country?: string;
      gfsi_certified?: boolean;
      gfsi_scheme?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Lokasyon adı zorunludur' }, { status: 400 });
    }

    const site = await createSite(id, {
      name: body.name,
      address: body.address ?? {},
      country: body.country ?? '',
      gfsi_certified: body.gfsi_certified ?? false,
      gfsi_scheme: body.gfsi_scheme ?? null,
    });
    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
