import { PrismaClient } from '@prisma/client';
import type { Permission } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// All SUPER_ADMIN permissions
const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  'VIEW_CANDIDATES',
  'EDIT_CANDIDATE_DETAILS',
  'SUSPEND_CANDIDATES',
  'MANAGE_PROGRAMMES',
  'MANAGE_INTAKES_COHORTS',
  'MARK_SUBMISSIONS',
  'MODERATE_GRADES',
  'MANAGE_EXAMS',
  'RESET_CANDIDATE_PROGRESS',
  'VIEW_FINANCE',
  'CONFIRM_PAYMENTS',
  'MANAGE_FINANCE',
  'ISSUE_CERTIFICATES',
  'REVOKE_CERTIFICATES',
  'MANAGE_ANNOUNCEMENTS',
  'MANAGE_BLOG',
  'RESPOND_SUPPORT',
  'MANAGE_STAFF',
  'VIEW_AUDIT_LOG',
];

async function createSuperAdmin() {
  try {
    // Hash the password
    const passwordHash = await bcrypt.hash('Tega71301564!', 12);

    // Create staff member with SUPER_ADMIN role and all permissions
    const staff = await prisma.staff.create({
      data: {
        name: 'Tega Odia',
        email: 'Praise1564@gmail.com',
        passwordHash,
        status: 'ACTIVE',
        staffRoles: {
          create: {
            staffRoleId: 'SUPER_ADMIN',
          },
        },
        permissionGrants: {
          create: SUPER_ADMIN_PERMISSIONS.map((permission) => ({
            permission,
          })),
        },
      },
      include: {
        staffRoles: true,
        permissionGrants: true,
      },
    });

    console.log('✅ Super Admin staff member created successfully!');
    console.log('Name:', staff.name);
    console.log('Email:', staff.email);
    console.log('ID:', staff.id);
    console.log('Status:', staff.status);
    console.log('Permissions:', staff.permissionGrants.map((g) => g.permission).join(', '));
  } catch (error) {
    console.error('❌ Error creating staff member:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
