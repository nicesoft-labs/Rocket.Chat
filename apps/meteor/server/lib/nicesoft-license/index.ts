export { reloadLicense, getCurrentLicense } from './cache';
export { isLicensed, hasFeature, getLimit } from './helpers';
export {
        loadLicenseFromStorage,
        readLicenseFromEnv,
        readLicenseFromFile,
        getLicenseFilePath,
        persistLicenseToDatabase,
        removeLicenseFromDatabase,
        readLicenseFromDatabase,
} from './storage';
export { validateLicenseDocument, parseLicensePayload, sanitizeLicensePayload, LicenseValidationError } from './validator';
export {
        getActiveUsersLimitInfo,
        getGuestUsersLimitInfo,
        isActiveUsersLimitReached,
        isGuestUsersLimitReached,
} from './limits';
export { onLicenseChanged, onLimitReached, onLimitRestored } from './events';
export { registerLimitCounter, shouldPreventAction, getLimitState } from './limitCounters';
export type { NicesoftLicenseDocument, LicenseState, LicenseStatus } from './types';
