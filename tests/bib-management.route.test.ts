import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), loadAuthContext: vi.fn(), hasPermission: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/auth/permissions', () => ({ loadAuthContext: mocks.loadAuthContext, hasPermission: mocks.hasPermission }));

import { GET, POST } from '@/app/api/organizer/events/[eventId]/bib-management/route';

function fakeAdmin() {
  const operations: Array<{ name: string; args: Record<string, unknown> }> = [];
  const admin = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: table === 'events' ? { id: 'event-1', organization_id: 'org-1', name: 'Test event' } : null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'race_categories' ? [{ id: 'category-1', name: '5K', distance_km: 5 }] : [], error: null }).then(resolve),
      };
      return chain;
    },
    rpc: async (name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }> => { operations.push({ name, args }); return { data: { rows: [], total: 0, page: 1, page_size: 20, total_pages: 1 }, error: null }; },
  };
  return { admin, operations };
}

const params = { params: { eventId: 'event-1' } };
const context = { user: { id: 'staff-1' }, internalRoles: [], memberships: [{ organization_id: 'org-1' }] };
const post = (body: unknown) => new Request('http://localhost/api/organizer/events/event-1/bib-management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('Bib Management API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAuthContext.mockResolvedValue(context);
    mocks.hasPermission.mockResolvedValue(true);
  });

  it('passes supported filters and pagination to the server-side list function', async () => {
    const fake = fakeAdmin(); mocks.createAdminClient.mockReturnValue(fake.admin);
    const response = await GET(new Request('http://localhost/api/organizer/events/event-1/bib-management?action=page&search=Ken&category_id=00000000-0000-4000-8000-000000000001&registration_type=guest&payment_status=succeeded&assignment_status=unassigned&page=2&page_size=30'), params) as Response;
    expect(response.status).toBe(200);
    expect(fake.operations[0]).toMatchObject({ name: 'bib_management_page', args: { p_search: 'Ken', p_registration_type: 'guest', p_payment_status: 'succeeded', p_assignment_status: 'unassigned', p_page: 2, p_page_size: 30 } });
  });

  it('rejects invalid bib numbers before calling the database', async () => {
    const fake = fakeAdmin(); mocks.createAdminClient.mockReturnValue(fake.admin);
    const response = await POST(post({ action: 'manual', registration_id: '00000000-0000-4000-8000-000000000002', bib_number: 0 }), params) as Response;
    expect(response.status).toBe(400);
    expect(fake.operations).toHaveLength(0);
  });

  it('uses the atomic manual assignment function with the authenticated staff ID', async () => {
    const fake = fakeAdmin(); fake.admin.rpc = async (name, args) => { fake.operations.push({ name, args }); return { data: { id: 'bib-1', bib_number: 50001 }, error: null }; }; mocks.createAdminClient.mockReturnValue(fake.admin);
    const response = await POST(post({ action: 'manual', registration_id: '00000000-0000-4000-8000-000000000002', bib_number: 50001 }), params) as Response;
    expect(response.status).toBe(200);
    expect(fake.operations[0]).toMatchObject({ name: 'assign_manual_bib', args: { p_event_id: 'event-1', p_registration_id: '00000000-0000-4000-8000-000000000002', p_bib_number: 50001, p_assigned_by: 'staff-1' } });
  });

  it('sends claimed-kit correction confirmation to the audited reassignment function', async () => {
    const fake = fakeAdmin(); fake.admin.rpc = async (name, args) => { fake.operations.push({ name, args }); return { data: { id: 'bib-1' }, error: null }; }; mocks.createAdminClient.mockReturnValue(fake.admin);
    const response = await POST(post({ action: 'reassign', bib_id: '00000000-0000-4000-8000-000000000003', bib_number: 50002, confirm_claimed_correction: true }), params) as Response;
    expect(response.status).toBe(200);
    expect(fake.operations[0]).toMatchObject({ name: 'reassign_event_bib', args: { p_bib_number: 50002, p_confirm_claimed_correction: true, p_changed_by: 'staff-1' } });
  });

  it('rejects an event without bib-management permission', async () => {
    const fake = fakeAdmin(); mocks.createAdminClient.mockReturnValue(fake.admin); mocks.hasPermission.mockResolvedValue(false);
    const response = await POST(post({ action: 'bulk' }), params) as Response;
    expect(response.status).toBe(403);
    expect(fake.operations).toHaveLength(0);
  });
});
