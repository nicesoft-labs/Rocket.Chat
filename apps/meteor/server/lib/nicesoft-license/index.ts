export { reloadLicense, getCurrentLicense } from './cache';
export { isLicensed, hasFeature, getLimit } from './helpers';
export {
	getActiveUsersLimitInfo,
	getGuestUsersLimitInfo,
	isActiveUsersLimitReached,
	isGuestUsersLimitReached,
} from './limits';
export type { NicesoftLicenseDocument, LicenseState } from './types';
