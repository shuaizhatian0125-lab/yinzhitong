import { isDemoMode } from '@/lib/config';
import { ROLE_PRESETS, CENTERS } from './permissions';
import type { SessionUser } from './auth';

if (!isDemoMode) {
  console.warn(
    '[DemoUsers] DEMO_MODE is false but demo-users module is loaded. ' +
    'Demo user data should not be used in production mode.',
  );
}

export type DemoUser = {
  id: string;
  tenantId: string;
  tenantName: string;
  username: string;
  password: string;
  displayName: string;
  title: string | null;
  roleCode: string;
  roleName: string;
  orgUnitId: string | null;
  orgName: string | null;
  dataScope: string;
  permissions: string[];
};

const tenantId = 'demo-tenant-001';
const tenantName = '银智通';

function buildDemoUser(
  username: string,
  password: string,
  displayName: string,
  title: string,
  roleCode: string,
  orgName: string | null,
): DemoUser {
  const preset = ROLE_PRESETS.find((r) => r.code === roleCode);
  if (!preset) throw new Error(`Unknown role: ${roleCode}`);

  return {
    id: `demo-${roleCode}-001`,
    tenantId,
    tenantName,
    username,
    password,
    displayName,
    title,
    roleCode,
    roleName: preset.name,
    orgUnitId: orgName ? `demo-org-${roleCode}` : null,
    orgName,
    dataScope: preset.dataScope,
    permissions: preset.permissions,
  };
}

export const DEMO_USERS: DemoUser[] = [
  buildDemoUser('admin', 'admin123', '系统管理员', '系统管理员', 'admin', '信息科技部'),
  buildDemoUser('manager', 'manager123', '张部门', '部门负责人', 'dept_head', '科技金融部'),
  buildDemoUser('staff', 'staff123', '李经理', '客户经理', 'staff', '科技金融部'),
];

export function findDemoUser(username: string, password: string): DemoUser | null {
  return DEMO_USERS.find((u) => u.username === username && u.password === password) ?? null;
}

export function demoUserToSessionUser(u: DemoUser): SessionUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    tenantName: u.tenantName,
    username: u.username,
    displayName: u.displayName,
    title: u.title,
    roleCode: u.roleCode,
    roleName: u.roleName,
    orgUnitId: u.orgUnitId,
    orgName: u.orgName,
    dataScope: u.dataScope,
    permissions: u.permissions,
  };
}

export function getDemoUserById(id: string): DemoUser | null {
  return DEMO_USERS.find((u) => u.id === id) ?? null;
}

export function getDemoMenus() {
  return CENTERS;
}