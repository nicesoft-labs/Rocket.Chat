import type { NicesoftLicenseDocument, NicesoftLicenseSource } from '@rocket.chat/core-typings';

export type { NicesoftLicenseDocument };

export interface LicenseState {
valid: boolean;
payload?: NicesoftLicenseDocument;
reason?: string;
source?: NicesoftLicenseSource;
filePath?: string;
}
