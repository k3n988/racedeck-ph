import { requireOrganizationContext } from '@/lib/auth/rbac';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import TeamMembersClient, { type TeamEventView, type TeamMemberView, type TeamRoleView } from './team-members-client';
export default async function OrganizerTeamMembersPage(){
  const {context,membership}=await requireOrganizationContext();
  const supabase=await createClient();
  const [{data:rows,error},{data:roles},{data:organization}]=await Promise.all([
    supabase.from('organization_members').select('id,user_id,role,is_active,restricted_event_ids,created_at,organization_id').eq('organization_id',membership.organization_id).order('created_at',{ascending:true}),
    supabase.from('organization_roles').select('role,display_name'),
    supabase.from('organizations').select('name').eq('id',membership.organization_id).maybeSingle(),
  ]);
  if(error){console.error('Unable to load team members',error);return <main className="mx-auto max-w-6xl p-6"><p role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Team members could not be loaded. Refresh the page to try again.</p></main>}
  const members=rows??[];
  const ids=members.map((m)=>m.user_id);
  const eventIds=Array.from(new Set(members.flatMap((m)=>m.restricted_event_ids??[])));
  const [{data:events},{data:profiles},{data:authUsers}]=await Promise.all([
    eventIds.length?supabase.from('events').select('id,name').eq('organization_id',membership.organization_id).in('id',eventIds):Promise.resolve({data:[] as TeamEventView[]}),
    ids.length?createAdminClient().from('user_profiles').select('id,first_name,last_name').in('id',ids):Promise.resolve({data:[]}),
    ids.length?createAdminClient().auth.admin.listUsers({page:1,perPage:1000}):Promise.resolve({data:{users:[]}}),
  ]);
  const eventById=new Map((events??[]).map((event)=>[event.id,event.name]));
  const profileById=new Map((profiles??[]).map((p)=>[p.id,p]));
  const authById=new Map((authUsers?.users??[]).filter((u)=>ids.includes(u.id)).map((u)=>[u.id,u]));
  const roleViews=(roles??[]).map((role):TeamRoleView=>({role:role.role,displayName:role.display_name}));
  const memberViews=members.map((member):TeamMemberView=>{
    const authUser=authById.get(member.user_id);
    const email=authUser?.email??null;
    return {
      id:member.id,userId:member.user_id,
      name:[profileById.get(member.user_id)?.first_name,profileById.get(member.user_id)?.last_name].filter(Boolean).join(' ')||email?.split('@')[0]||'Unnamed member',
      email,role:member.role,roleLabel:roleViews.find((role)=>role.role===member.role)?.displayName??member.role,
      isActive:member.is_active,invitePending:Boolean(authUser?.invited_at&&!authUser.last_sign_in_at),allEvents:member.restricted_event_ids===null,
      restrictedEventIds:(member.restricted_event_ids??[]).filter((id)=>eventById.has(id)),
    };
  });
  const canManage=membership.role==='owner'||membership.permissions.includes('manage_team');
  return <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><TeamMembersClient members={memberViews} roles={roleViews} events={(events??[]).map((e):TeamEventView=>({id:e.id,name:e.name}))} canManage={canManage} currentUserId={context.user.id} organizationName={organization?.name??'your organization'}/></main>
}
