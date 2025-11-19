import { EventEmitter } from 'events';

import type { LicenseState } from './types';

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

type LicenseEventMap = {
        licenseChanged: (state: LicenseState) => void;
        limitReached: (limit: string) => void;
        limitRestored: (limit: string) => void;
};

const addListener = <T extends keyof LicenseEventMap>(event: T, handler: LicenseEventMap[T]): (() => void) => {
        emitter.on(event, handler);
        return () => {
                emitter.off(event, handler);
        };
};

export const emitLicenseChanged = (state: LicenseState): void => {
        emitter.emit('licenseChanged', state);
};

export const emitLimitReached = (limit: string): void => {
        emitter.emit('limitReached', limit);
};

export const emitLimitRestored = (limit: string): void => {
        emitter.emit('limitRestored', limit);
};

export const onLicenseChanged = (handler: LicenseEventMap['licenseChanged']): (() => void) =>
        addListener('licenseChanged', handler);

export const onLimitReached = (handler: LicenseEventMap['limitReached']): (() => void) =>
        addListener('limitReached', handler);

export const onLimitRestored = (handler: LicenseEventMap['limitRestored']): (() => void) =>
        addListener('limitRestored', handler);
