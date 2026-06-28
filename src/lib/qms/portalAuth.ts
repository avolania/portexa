import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { findSupplierUser } from './repositories/supplierPortal.repo';
import type { SupplierUser } from './types';

export async function getPortalCtx(req: NextRequest): Promise<{
  user: SupplierUser;
  authUserId: string;
} | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const supplierUser = await findSupplierUser(user.id);
  if (!supplierUser || !supplierUser.is_active) return null;
  return { user: supplierUser, authUserId: user.id };
}
