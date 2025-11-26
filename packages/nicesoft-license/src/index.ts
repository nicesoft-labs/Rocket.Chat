/*
 * Nicesoft License provider compatible with the legacy Rocket.Chat license API.
 */

import { validateWarnLimit } from './validation/validateLimit';

export type LicenseStatus = {
        status: 'active' | 'invalid' | 'expired';
        expiration: string | 'never';
        source: string;
        maxActiveUsers: number;
};

export class DuplicatedLicenseError extends Error {
        constructor(message = 'Duplicated license detected') {
                super(message);
                this.name = 'DuplicatedLicenseError';
        }
}

export class DisabledLicense {
        protected maxActiveUsers: number;

        private limitListeners = new Map<string, Set<() => void>>();

        private validateListeners = new Set<() => void>();

        private invalidateListeners = new Set<() => void>();

        constructor(maxActiveUsers = 20) {
                this.maxActiveUsers = maxActiveUsers;
        }

        getLicenseStatus(): LicenseStatus {
                return {
                        status: 'active',
                        expiration: 'never',
                        source: 'NicesoftCloud',
                        maxActiveUsers: this.maxActiveUsers,
                };
        }

        hasValidLicense(): boolean {
                return true;
        }

        hasModule(_feature: string): boolean {
                return true;
        }

        isFeatureEnabled(_feature: string): boolean {
                return true;
        }

        getModules(): string[] {
                return [];
        }

        getTags(): Array<{ name: string }> {
                return [];
        }

        getGuestPermissions(): string[] {
                return [];
        }

        getMaxActiveUsers(): number {
                return this.maxActiveUsers;
        }

        getLicense(): Record<string, any> {
                return {
                        information: {
                                status: 'active',
                                trial: false,
                                maxActiveUsers: this.maxActiveUsers,
                                source: 'NicesoftCloud',
                                expiration: 'never',
                        },
                        supportedVersions: undefined,
                        limits: {},
                };
        }

        async refresh(): Promise<number> {
                return this.maxActiveUsers;
        }

        onLicenseChange(_cb: () => void): () => void {
                return () => undefined;
        }

        onLimitReached(action: string, cb: () => void): () => void {
                const listeners = this.limitListeners.get(action) ?? new Set<() => void>();
                listeners.add(cb);
                this.limitListeners.set(action, listeners);
                return () => listeners.delete(cb);
        }

        onValidateLicense(cb: () => void): () => void {
                this.validateListeners.add(cb);
                return () => this.validateListeners.delete(cb);
        }

        onInvalidateLicense(cb: () => void): () => void {
                this.invalidateListeners.add(cb);
                return () => this.invalidateListeners.delete(cb);
        }

        protected triggerLimit(action: string) {
                const listeners = this.limitListeners.get(action);
                listeners?.forEach((cb) => {
                        try {
                                cb();
                        } catch (error) {
                                console.warn('Nicesoft license limit listener failed', error);
                        }
                });
        }

        protected triggerValidate() {
                this.validateListeners.forEach((cb) => {
                        try {
                                cb();
                        } catch (error) {
                                console.warn('Nicesoft license validate listener failed', error);
                        }
                });
        }

        protected triggerInvalidate() {
                this.invalidateListeners.forEach((cb) => {
                        try {
                                cb();
                        } catch (error) {
                                console.warn('Nicesoft license invalidate listener failed', error);
                        }
                });
        }

        async shouldPreventAction(_action: string, currentValue = 0): Promise<boolean> {
                return currentValue >= this.maxActiveUsers;
        }
}

export class NicesoftLicense extends DisabledLicense {
        private listeners = new Set<() => void>();

        private licenseKey?: string;

        constructor(maxActiveUsers = 20, private readonly apiBase = process.env.NICESOFT_LICENSE_API) {
                super(maxActiveUsers);
                console.info('Nicesoft License Provider active: limit=%d', this.maxActiveUsers);
        }

        async refresh(activeUsers?: number): Promise<number> {
                if (typeof activeUsers !== 'number' || activeUsers <= this.maxActiveUsers) {
                        return this.maxActiveUsers;
                }

                const endpointBase = this.apiBase?.replace(/\/$/, '');
                if (!endpointBase) {
                        return this.maxActiveUsers;
                }

                try {
                        const response = await fetch(`${endpointBase}/v1/license/check`, {
                                method: 'POST',
                                headers: {
                                        'content-type': 'application/json',
                                },
                                body: JSON.stringify({
                                        activeUsers,
                                        currentLimit: this.maxActiveUsers,
                                        license: this.licenseKey,
                                }),
                        });

                        if (!response.ok) {
                                return this.maxActiveUsers;
                        }

                        const payload = (await response.json()) as { maxActiveUsers?: number };
                        if (typeof payload.maxActiveUsers === 'number' && payload.maxActiveUsers > this.maxActiveUsers) {
                                this.maxActiveUsers = payload.maxActiveUsers;
                                this.notifyChange();
                        }
                } catch (error) {
                        console.warn('Nicesoft license check failed, keeping current limit', error);
                }

                return this.maxActiveUsers;
        }

        onLicenseChange(cb: () => void): () => void {
                this.listeners.add(cb);
                return () => this.listeners.delete(cb);
        }

        isLimitReached(activeUsers: number): boolean {
                return activeUsers > this.maxActiveUsers;
        }

        async checkUserLimit(activeUsers: number): Promise<number> {
                if (this.isLimitReached(activeUsers)) {
                        await this.refresh(activeUsers);
                }

                return this.maxActiveUsers;
        }

        async shouldPreventAction(action: string, currentValue = 0): Promise<boolean> {
                if (action === 'activeUsers' && currentValue >= this.maxActiveUsers) {
                        await this.refresh(currentValue);
                        if (currentValue >= this.maxActiveUsers) {
                                this.triggerLimit(action);
                                return true;
                        }
                }

                return false;
        }

        applyLicense(licenseKey: string): LicenseStatus {
                this.licenseKey = licenseKey;
                this.notifyChange();
                this.triggerValidate();
                return this.getLicenseStatus();
        }

        getLicense(): Record<string, any> {
                return {
                        information: {
                                status: 'active',
                                trial: false,
                                maxActiveUsers: this.maxActiveUsers,
                                source: 'NicesoftCloud',
                                expiration: 'never',
                                license: this.licenseKey,
                        },
                        supportedVersions: undefined,
                        limits: {},
                };
        }

        private notifyChange() {
                for (const cb of this.listeners) {
                        try {
                                cb();
                        } catch (error) {
                                console.warn('Nicesoft license listener failed', error);
                        }
                }
        }
}

export const License = new NicesoftLicense();

export const applyLicense = async (licenseKey: string): Promise<LicenseStatus> => {
        return License.applyLicense(licenseKey);
};

export class AirGappedRestriction {
        static async computeRestriction(_token?: string | null): Promise<void> {
                        return;
        }

        static async isRestricted(): Promise<boolean> {
                return false;
        }
}

export type LicenseImp = NicesoftLicense;
export type LicenseManager = NicesoftLicense;

export { validateWarnLimit };
