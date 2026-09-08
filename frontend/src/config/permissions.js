/**
 * FleetFlow Role & Permissions Configuration
 * Centralized matrix for role-based access control (RBAC),
 * navigation items, and dashboard routing.
 */

import {
  LayoutDashboard,
  Package2,
  Users,
  UserCircle2,
  Truck,
  Route,
  Wrench,
  Fuel,
  CalendarCheck,
  BarChart3,
  Bell,
  Settings,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

export const ROLES = {
  ADMIN: 'Admin',
  FLEET_MANAGER: 'FleetManager',
  DISPATCHER: 'Dispatcher',
  DRIVER: 'Driver',
};

export const ROLE_DASHBOARDS = {
  Admin: '/admin/dashboard',
  FleetManager: '/fleet/dashboard',
  Dispatcher: '/dispatcher/dashboard',
  Driver: '/driver/dashboard',
};

export function getDashboardRoute(role) {
  switch (role) {
    case 'Admin': return '/admin/dashboard';
    case 'FleetManager': return '/fleet/dashboard';
    case 'Dispatcher': return '/dispatcher/dashboard';
    case 'Driver': return '/driver/dashboard';
    default: return '/unauthorized';
  }
}

// ---------------------------------------------------------------------------
// CRUD Permission Matrix: ROLE_PERMISSIONS[role][resource] = [actions]
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS = {
  Admin: {
    users:         ['create','read','update','delete'],
    vehicles:      ['create','read','update','delete'],
    drivers:       ['create','read','update','delete'],
    trips:         ['create','read','update','delete'],
    shipments:     ['create','read','update','delete'],
    fuel:          ['create','read','update','delete'],
    maintenance:   ['create','read','update','delete'],
    attendance:    ['create','read','update','delete'],
    work_updates:  ['create','read','update','delete'],
    reports:       ['read'],
    settings:      ['read','update'],
    notifications: ['create','read','update','delete'],
    profile:       ['read','update'],
    audit_logs:    ['read'],
  },
  FleetManager: {
    users:         ['read'],
    vehicles:      ['create','read','update'],
    drivers:       ['create','read','update'],
    trips:         ['create','read','update','delete'],
    shipments:     ['create','read','update'],
    fuel:          ['create','read','update'],
    maintenance:   ['create','read','update'],
    attendance:    ['read','update'],
    work_updates:  ['create','read','update'],
    reports:       ['read'],
    settings:      [],
    notifications: ['create','read'],
    profile:       ['read','update'],
    audit_logs:    [],
  },
  Dispatcher: {
    users:         [],
    vehicles:      ['read'],
    drivers:       ['read'],
    trips:         ['create','read','update','assign'],
    shipments:     ['read','update'],
    fuel:          ['read'],
    maintenance:   ['read'],
    attendance:    ['read'],
    work_updates:  ['read'],
    reports:       ['read'],
    settings:      [],
    notifications: ['read'],
    profile:       ['read','update'],
    audit_logs:    [],
  },
  Driver: {
    users:         [],
    vehicles:      ['read'],
    drivers:       ['read'],
    trips:         ['read','update_status'],
    shipments:     ['read'],
    fuel:          ['create','read','update'],
    maintenance:   [],
    attendance:    ['create','read','update'],
    work_updates:  ['create','read','update'],
    reports:       [],
    settings:      [],
    notifications: ['read'],
    profile:       ['read','update'],
    audit_logs:    [],
  },
};

/**
 * Check whether a role can perform an action on a resource.
 * hasPermission('Driver', 'vehicles', 'delete') => false
 * hasPermission('Admin',  'vehicles', 'delete') => true
 */
export function hasPermission(role, resource, action) {
  if (!role) return false;
  const rolePerms = ROLE_PERMISSIONS[role];
  if (!rolePerms) return false;
  const actions = rolePerms[resource];
  if (!actions) return false;
  return actions.includes(action);
}

// Legacy flat tokens kept for backwards compat
export const PERMISSIONS = {
  MANAGE_USERS:         'manage_users',
  VIEW_AUDIT_LOGS:      'view_audit_logs',
  MANAGE_VEHICLES:      'manage_vehicles',
  VIEW_VEHICLES:        'view_vehicles',
  MANAGE_DRIVERS:       'manage_drivers',
  VIEW_DRIVERS:         'view_drivers',
  MANAGE_SHIPMENTS:     'manage_shipments',
  VIEW_SHIPMENTS:       'view_shipments',
  MANAGE_TRIPS:         'manage_trips',
  VIEW_TRIPS:           'view_trips',
  MANAGE_MAINTENANCE:   'manage_maintenance',
  MANAGE_FUEL:          'manage_fuel',
  VIEW_REPORTS:         'view_reports',
  VIEW_ALL_ATTENDANCE:  'view_all_attendance',
  VIEW_MY_TASKS:        'view_my_tasks',
  SUBMIT_WORK_UPDATE:   'submit_work_update',
  EDIT_MY_WORK_UPDATE:  'edit_my_work_update',
  EDIT_ANY_WORK_UPDATE: 'edit_any_work_update',
  VIEW_MY_ATTENDANCE:   'view_my_attendance',
  VIEW_MY_VEHICLE:      'view_my_vehicle',
};

// ---------------------------------------------------------------------------
// Navigation Items per role
// ---------------------------------------------------------------------------
export const NAVIGATION_ITEMS = {
  Admin: [
    { label: 'Overview',      to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Audit Logs',    to: '/admin/audit-logs',icon: ClipboardList },
    { label: 'Work Updates',  to: '/work-updates',    icon: ClipboardList },
    { label: 'Shipments',     to: '/shipments',       icon: Package2 },
    { label: 'Users',         to: '/users',           icon: Users },
    { label: 'Drivers',       to: '/drivers',         icon: UserCircle2 },
    { label: 'Vehicles',      to: '/vehicles',        icon: Truck },
    { label: 'Trips',         to: '/trips',           icon: Route },
    { label: 'Maintenance',   to: '/maintenance',     icon: Wrench },
    { label: 'Fuel',          to: '/fuel',            icon: Fuel },
    { label: 'Attendance',    to: '/attendance',      icon: CalendarCheck },
    { label: 'Reports',       to: '/reports',         icon: BarChart3 },
    { label: 'Notifications', to: '/notifications',   icon: Bell },
    { label: 'Settings',      to: '/settings',        icon: Settings },
  ],
  FleetManager: [
    { label: 'Overview',      to: '/fleet/dashboard', icon: LayoutDashboard },
    { label: 'Work Updates',  to: '/work-updates',    icon: ClipboardList },
    { label: 'Shipments',     to: '/shipments',       icon: Package2 },
    { label: 'Vehicles',      to: '/vehicles',        icon: Truck },
    { label: 'Drivers',       to: '/drivers',         icon: UserCircle2 },
    { label: 'Trips',         to: '/trips',           icon: Route },
    { label: 'Maintenance',   to: '/maintenance',     icon: Wrench },
    { label: 'Fuel',          to: '/fuel',            icon: Fuel },
    { label: 'Attendance',    to: '/attendance',      icon: CalendarCheck },
    { label: 'Reports',       to: '/reports',         icon: BarChart3 },
    { label: 'Notifications', to: '/notifications',   icon: Bell },
  ],
  Dispatcher: [
    { label: 'Dispatch Overview', to: '/dispatcher/dashboard', icon: LayoutDashboard },
    { label: 'Trip Dispatch',     to: '/trips',                icon: Route },
    { label: 'Shipments',         to: '/shipments',            icon: Package2 },
    { label: 'Vehicles',          to: '/vehicles',             icon: Truck },
    { label: 'Drivers',           to: '/drivers',              icon: UserCircle2 },
    { label: 'Driver Attendance', to: '/attendance',           icon: CalendarCheck },
    { label: 'Notifications',     to: '/notifications',        icon: Bell },
    { label: 'My Profile',        to: '/profile',              icon: UserCircle2 },
  ],
  Driver: [
    { label: 'My Dashboard',   to: '/driver/dashboard', icon: LayoutDashboard },
    { label: 'Work Updates',   to: '/work-updates',     icon: ClipboardList },
    { label: 'Assigned Trips', to: '/trips',            icon: Route },
    { label: 'My Shipments',   to: '/shipments',        icon: Package2 },
    { label: 'My Vehicle',     to: '/vehicles',         icon: Truck },
    { label: 'Attendance',     to: '/attendance',       icon: CalendarCheck },
    { label: 'Fuel Logging',   to: '/fuel',             icon: Fuel },
    { label: 'Report Issue',   to: '/report-issue',     icon: AlertTriangle },
    { label: 'My Profile',        to: '/profile',          icon: UserCircle2 },
  ],
};

export function getNavigationItems(role) {
  return NAVIGATION_ITEMS[role] || NAVIGATION_ITEMS['Driver'];
}
