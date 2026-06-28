import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { canViewQms, canManageQms } from '@/lib/qms/permissions';
import {
  findSupplierById,
  findSitesBySupplier,
  updateSupplier,
  deleteSupplier,
} from '@/lib/qms/repositories/supplier.repo';
import { findDocumentsBySupplier } from '@/lib/qms/repositories/document.repo';
import type { UpdateSupplierDto } from '@/lib/qms/types';

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
    return NextResponse.json({ ...supplier, sites });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
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

    const dto = await req.json() as UpdateSupplierDto;
    const updated = await updateSupplier(id, { ...dto, updated_at: new Date().toISOString() });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
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

    const docs = await findDocumentsBySupplier(id);
    if (docs.length > 0) {
      return NextResponse.json(
        { error: 'Bu tedarikçiye ait dokümanlar mevcut. Önce dokümanları silin.' },
        { status: 409 }
      );
    }

    await deleteSupplier(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
