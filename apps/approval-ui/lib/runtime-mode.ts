import {
  getAuthonRuntimeMode as getSharedRuntimeMode,
  isCloudRuntimeMode as isSharedCloudRuntimeMode,
  isOpenCoreRuntimeMode as isSharedOpenCoreRuntimeMode,
  type AuthonRuntimeMode,
} from '@approva/config';
import type { Organization } from '@approva/shared';

export function getAuthonRuntimeMode(): AuthonRuntimeMode {
  return getSharedRuntimeMode(process.env);
}

export function isOpenCoreRuntimeMode() {
  return isSharedOpenCoreRuntimeMode(process.env);
}

export function isCloudRuntimeMode() {
  return isSharedCloudRuntimeMode(process.env);
}

export function getDefaultOrganizationSlug() {
  return process.env.AUTHON_DEFAULT_ORGANIZATION_SLUG?.trim() || 'default';
}

export function getDefaultOrganizationName() {
  return process.env.AUTHON_DEFAULT_ORGANIZATION_NAME?.trim() || 'Default Organization';
}

export function getAuthonReleaseLabel() {
  return (
    process.env.NEXT_PUBLIC_APPROVA_RELEASE?.trim() ||
    process.env.NEXT_PUBLIC_AUTHON_RELEASE?.trim() ||
    'Open Core · 2026.03'
  );
}

export function buildOpenCoreOrganization(): Organization {
  return {
    id: `open-core:${getDefaultOrganizationSlug()}`,
    name: getDefaultOrganizationName(),
    slug: getDefaultOrganizationSlug(),
    createdAt: new Date(0).toISOString(),
    ownerUserId: null,
    onboardingCompletedAt: new Date(0).toISOString(),
  };
}
