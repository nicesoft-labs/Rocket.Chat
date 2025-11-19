import type { ISetting } from '@rocket.chat/core-typings';

export const getSettingPermissionId = function (settingId: ISetting['_id']) {
	// setting-based permissions
	return `change-setting-${settingId}`;
};

export const CONSTANTS = {
	SETTINGS_LEVEL: 'settings',
} as const;

export const confirmationRequiredPermissions = ['access-permissions'];

export const CE_GUEST_PERMISSIONS = ['view-d-room', 'view-joined-room', 'view-p-room', 'start-discussion'] as const;

export const ADVANCED_GUEST_PERMISSIONS = [...CE_GUEST_PERMISSIONS, 'mobile-upload-file'] as const;

export { AuthorizationUtils } from './AuthorizationUtils';
