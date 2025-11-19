import { Meteor } from 'meteor/meteor';

import { API } from '../api';
import { reloadLicense, getCurrentLicense } from '../../../../server/lib/nicesoft-license';
import type { LicenseState } from '../../../../server/lib/nicesoft-license/types';
import { LicenseValidationError, parseLicensePayload } from '../../../../server/lib/nicesoft-license/validator';
import {
        persistLicenseToFile,
        removeLicenseFile,
        persistLicenseToDatabase,
        removeLicenseFromDatabase,
} from '../../../../server/lib/nicesoft-license/storage';
import { emitLicenseUpdated } from '../../../../server/lib/nicesoft-license/events';
import notifications from '../../../notifications/server/lib/Notifications';
import type { NicesoftLicenseInfoResult } from '@rocket.chat/rest-typings';
import { getUploadFormData } from '../lib/getUploadFormData';

const buildPayload = (statePayload: LicenseState['payload']): NicesoftLicenseInfoResult['payload'] => ({
        product: statePayload?.product ?? null,
        edition: statePayload?.edition ?? null,
        tenant: statePayload?.tenant,
        valid_from: statePayload?.valid_from ?? null,
        valid_to: statePayload?.valid_to ?? null,
        features: statePayload?.features ?? [],
        limits: statePayload?.limits ?? {},
});

const buildLicenseInfoResponse = (state: LicenseState = getCurrentLicense()): NicesoftLicenseInfoResult => {
        const payload = buildPayload(state.payload);
        const expires_in = (() => {
                if (!payload.valid_to) {
                        return null;
                }

                const expiresDate = new Date(payload.valid_to);
                if (Number.isNaN(expiresDate.getTime())) {
                        return null;
                }

                return Math.floor((expiresDate.getTime() - Date.now()) / 1000);
        })();

        return {
                status: state.status,
                source: state.source ?? null,
                reason: state.reason ?? null,
                expires_in,
                payload,
        };
};

const broadcastLicenseUpdated = (state: LicenseState): void => {
        const payload = buildLicenseInfoResponse(state);
        emitLicenseUpdated(state);
        notifications.streamAll.emit('licenseUpdated', payload);
};

const getContentType = (request?: Request): string | undefined => {
        if (!request) {
                return undefined;
        }

        if (typeof request.headers.get === 'function') {
                return request.headers.get('content-type') ?? undefined;
        }

        const headers = (request as any).headers as Record<string, string> | undefined;
        return headers?.['content-type'];
};

const extractLicensePayload = async (bodyParams: unknown, request?: Request): Promise<unknown> => {
        const contentType = getContentType(request);

        if (contentType && !/multipart\/form-data|application\/json|text\//i.test(contentType)) {
                throw new Meteor.Error('unsupported-media-type', 'Unsupported content type');
        }

        if (contentType?.includes('multipart/form-data') && request) {
                const { fileBuffer, fields } = await getUploadFormData<{ file?: Blob }, { license?: string }>({ request }, {
                        field: 'file',
                        fileOptional: true,
                });

                const payload = fileBuffer?.toString('utf-8') ?? fields.license;
                if (payload && payload.trim()) {
                        return payload;
                }

                throw new Meteor.Error('error-invalid-license-json', 'License payload is required');
        }

        if (bodyParams && typeof bodyParams === 'object' && 'license' in (bodyParams as Record<string, any>)) {
                return (bodyParams as Record<string, any>).license;
        }

        if (bodyParams !== undefined && bodyParams !== null) {
                return bodyParams;
        }

        if (request) {
                const rawText = await request.text();
                if (rawText.trim()) {
                        return rawText;
                }
        }

        throw new Meteor.Error('error-invalid-license-json', 'License payload is required');
};

const normalizeLicenseDocument = (payload: unknown) => {
        try {
                const document = parseLicensePayload(payload);
                const serialized = JSON.stringify(document, null, 2);
                return { document, serialized };
        } catch (error: any) {
                if (error instanceof LicenseValidationError) {
                        const code = {
                                json: 'error-invalid-license-json',
                                schema: 'invalid-license-schema',
                                signature: 'invalid-license-signature',
                                dates: 'invalid-license-dates',
                        }[error.kind];
                        throw new Meteor.Error(code, error.message);
                }

                throw error;
        }
};

const handleLicenseUpload = async (bodyParams: unknown, request?: Request): Promise<NicesoftLicenseInfoResult> => {
        const rawPayload = await extractLicensePayload(bodyParams, request);
        const normalized = normalizeLicenseDocument(rawPayload);

        await persistLicenseToFile(normalized.serialized);
        await persistLicenseToDatabase(normalized.serialized);

        await reloadLicense();
        const state = getCurrentLicense();
        broadcastLicenseUpdated(state);

        return buildLicenseInfoResponse(state);
};

const handleLicenseDelete = async (): Promise<NicesoftLicenseInfoResult> => {
        await Promise.all([removeLicenseFile(), removeLicenseFromDatabase()]);

        await reloadLicense();
        const state = getCurrentLicense();
        if (state.source === 'env') {
                throw new Meteor.Error('license-env-readonly', 'License loaded from environment and cannot be removed', {
                        source: 'env',
                });
        }

        broadcastLicenseUpdated(state);

        return buildLicenseInfoResponse(state);
};

API.v1.addRoute(
        'nicesoft.license.info',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async get() {
                        return API.v1.success(buildLicenseInfoResponse());
                },
        },
);

API.v1.addRoute(
        'nicesoft.license.upload',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async post() {
                        try {
                                const response = await handleLicenseUpload(this.bodyParams, this.request as Request);
                                return API.v1.success(response);
                        } catch (error: any) {
                                if (error instanceof Meteor.Error) {
                                        if (
                                                [
                                                        'error-invalid-license-json',
                                                        'invalid-license-schema',
                                                        'invalid-license-signature',
                                                        'invalid-license-dates',
                                                        'unsupported-media-type',
                                                ].includes(error.error),
                                        ) {
                                                return API.v1.failure(error.reason || error.error, error.error);
                                        }

                                        return API.v1.failure(error.reason || error.error);
                                }

                                return API.v1.internalError(error?.message ?? 'Failed to process license');
                        }
                },
        },
);

API.v1.addRoute(
        'nicesoft.license',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async delete() {
                        try {
                                const response = await handleLicenseDelete();
                                return API.v1.success(response);
                        } catch (error: any) {
                                if (error instanceof Meteor.Error) {
                                        return API.v1.failure(error.reason || error.error, error.error);
                                }

                                return API.v1.internalError(error?.message ?? 'Failed to delete license file');
                        }
                },
        },
);

export {
        buildLicenseInfoResponse,
        extractLicensePayload,
        normalizeLicenseDocument,
        handleLicenseUpload,
        handleLicenseDelete,
};
