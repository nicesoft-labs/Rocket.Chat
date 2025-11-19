import type { NicesoftLicenseDocument, NicesoftLicenseSource } from '@rocket.chat/core-typings';

export type NicesoftLicenseStatus = 'valid' | 'invalid' | 'missing';

export type NicesoftLicenseInfoResult = {
        status: NicesoftLicenseStatus;
        payload?: NicesoftLicenseDocument;
        expiresAt?: string;
        reason?: string;
        source?: NicesoftLicenseSource;
        filePath?: string;
};

export type NicesoftLicenseUploadParams = {
        license: string;
};

export type NicesoftLicenseEndpoints = {
        '/v1/nicesoft.license.info': {
                GET: () => NicesoftLicenseInfoResult;
        };
        '/v1/nicesoft.license.upload': {
                POST: (params: NicesoftLicenseUploadParams) => NicesoftLicenseInfoResult;
        };
};
