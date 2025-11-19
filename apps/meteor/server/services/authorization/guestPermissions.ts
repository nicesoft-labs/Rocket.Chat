import { ADVANCED_GUEST_PERMISSIONS, CE_GUEST_PERMISSIONS } from '../../../app/authorization/lib';
import { hasFeature } from '../../lib/nicesoft-license';

const ADVANCED_GUEST_FEATURE = 'guest.advanced';

export const getGuestPermissionWhitelist = (): string[] =>
        hasFeature(ADVANCED_GUEST_FEATURE)
                ? [...ADVANCED_GUEST_PERMISSIONS]
                : [...CE_GUEST_PERMISSIONS];
