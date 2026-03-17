import {
  getAuthonRuntimeMode as getSharedRuntimeMode,
  isCloudRuntimeMode as isSharedCloudRuntimeMode,
  isOpenCoreRuntimeMode as isSharedOpenCoreRuntimeMode,
  type AuthonRuntimeMode,
} from '@approva/config';

export function getAuthonRuntimeMode(): AuthonRuntimeMode {
  return getSharedRuntimeMode(process.env);
}

export function isOpenCoreRuntimeMode() {
  return isSharedOpenCoreRuntimeMode(process.env);
}

export function isCloudRuntimeMode() {
  return isSharedCloudRuntimeMode(process.env);
}
