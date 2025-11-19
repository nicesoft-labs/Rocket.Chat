import type { NicesoftLicenseDocument } from '@rocket.chat/core-typings';

import { emitLicenseChanged } from './events';
import { loadLicenseFromStorage, type LicenseStorageResult } from './storage';
import type { LicenseState, NicesoftLicensePayload } from './types';
import { LicenseValidationError, sanitizeLicensePayload, validateLicenseDocument } from './validator';

let currentState: LicenseState = {
        status: 'missing',
        valid: false,
        payload: null,
        features: [],
        limits: {},
        reason: null,
        source: undefined,
        filePath: undefined,
};

const buildInvalidState = (
        reason: string,
        source?: LicenseStorageResult['source'],
        filePath?: string,
        payload?: LicenseState['payload'],
): LicenseState => ({
        status: 'invalid',
        valid: false,
        payload: payload ?? null,
        features: payload?.features ?? [],
        limits: payload?.limits ?? {},
        reason,
        source,
        filePath,
});

const buildMissingState = (): LicenseState => ({
        ...currentState,
        status: 'missing',
        valid: false,
        payload: null,
        features: [],
        limits: {},
        reason: null,
        source: undefined,
        filePath: undefined,
});

const buildValidState = (
        document: NicesoftLicensePayload,
        source: LicenseStorageResult['source'],
        filePath?: string,
): LicenseState => ({
        status: 'valid',
        valid: true,
        payload: document,
        features: document.features,
        limits: document.limits,
        reason: null,
        source,
        filePath,
});

const updateState = (state: LicenseState): void => {
        currentState = state;
        emitLicenseChanged(currentState);
};

export const reloadLicense = async (): Promise<void> => {
        let storageResult: LicenseStorageResult | null = null;
        try {
                storageResult = await loadLicenseFromStorage();
        } catch (error: any) {
                updateState(buildInvalidState(error?.message ?? 'Failed to load license'));
                return;
        }

        if (!storageResult) {
                updateState(buildMissingState());
                return;
        }

        try {
                const payload = JSON.parse(storageResult.content);
                const document = validateLicenseDocument(payload);
                const sanitized = sanitizeLicensePayload(document);
                updateState(buildValidState(sanitized, storageResult.source, storageResult.path));
        } catch (error: any) {
                const payload =
                        error instanceof LicenseValidationError && error.payload
                                ? sanitizeLicensePayload(error.payload as NicesoftLicenseDocument)
                                : undefined;

                updateState(
                        buildInvalidState(
                                error?.message ?? 'Invalid license document',
                                storageResult.source,
                                storageResult.path,
                                payload,
                        ),
                );
        }
};

export const getCurrentLicense = (): LicenseState => currentState;
