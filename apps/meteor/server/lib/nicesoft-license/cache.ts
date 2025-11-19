import type { NicesoftLicenseDocument } from '@rocket.chat/core-typings';

import { emitLicenseChanged } from './events';
import { loadLicenseFromStorage, type LicenseStorageResult } from './storage';
import type { LicenseState } from './types';
import { validateLicenseDocument } from './validator';

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

const buildInvalidState = (reason: string, source?: LicenseStorageResult['source'], filePath?: string): LicenseState => ({
        status: 'invalid',
        valid: false,
        payload: null,
        features: [],
        limits: {},
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

const buildValidState = (document: NicesoftLicenseDocument, source: LicenseStorageResult['source'], filePath?: string): LicenseState => ({
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
                updateState(buildValidState(document, storageResult.source, storageResult.path));
        } catch (error: any) {
                updateState(buildInvalidState(error?.message ?? 'Invalid license document', storageResult.source, storageResult.path));
        }
};

export const getCurrentLicense = (): LicenseState => currentState;
