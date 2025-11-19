import type { NicesoftLicenseDocument } from '@rocket.chat/core-typings';

import { loadLicenseFromStorage, type LicenseStorageResult } from './storage';
import type { LicenseState } from './types';

let currentState: LicenseState = {
valid: false,
reason,
payload: undefined,
source: undefined,
filePath: undefined,
};

const buildInvalidState = (reason: string): LicenseState => ({
	valid: false,
	reason,
});

const validateLicenseDocument = (payload: unknown): NicesoftLicenseDocument => {
	if (!payload || typeof payload !== 'object') {
		throw new Error('License payload is empty');
	}

	const document = payload as Partial<NicesoftLicenseDocument>;
	if (!document.product || !document.edition) {
		throw new Error('License payload is missing required fields');
	}

	return document as NicesoftLicenseDocument;
};

export const reloadLicense = async (): Promise<void> => {
let storageResult: LicenseStorageResult | null = null;
try {
storageResult = await loadLicenseFromStorage();
} catch (error: any) {
currentState = buildInvalidState(error?.message ?? 'Failed to load license');
return;
}


	if (!storageResult) {
		currentState = buildInvalidState('No license found');
		return;
	}

try {
const payload = JSON.parse(storageResult.content);
const document = validateLicenseDocument(payload);
currentState = {
valid: true,
payload: document,
source: storageResult.source,
filePath: storageResult.path,
};
} catch (error: any) {
currentState = {
...buildInvalidState(error?.message ?? 'Invalid license document'),
source: storageResult.source,
filePath: storageResult.path,
};
}
};

export const getCurrentLicense = (): LicenseState => currentState;
