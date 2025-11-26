import fs from 'node:fs';
import path from 'node:path';

export type CloudConnectionStatus = {
        connected: boolean;
        workspaceId: string | null;
        updatedAt: string;
};

export interface CloudController {
        status(): Promise<CloudConnectionStatus>;
        connect(workspaceId: string): Promise<CloudConnectionStatus>;
        disconnect(): Promise<CloudConnectionStatus>;
        checkConnection(): Promise<boolean>;
}

const DEFAULT_STORAGE = process.env.NICESOFT_CLOUD_STORE ?? path.join(process.cwd(), 'nicesoft-cloud.json');

export class NicesoftCloudController implements CloudController {
        private state: CloudConnectionStatus = {
                connected: false,
                workspaceId: null,
                updatedAt: new Date(0).toISOString(),
        };

        constructor(private readonly storagePath: string = DEFAULT_STORAGE) {
                this.restore();
        }

        async status(): Promise<CloudConnectionStatus> {
                return this.state;
        }

        async connect(workspaceId: string): Promise<CloudConnectionStatus> {
                if (!workspaceId || typeof workspaceId !== 'string') {
                        throw new Error('workspaceId must be a non-empty string');
                }

                this.updateState({
                        connected: true,
                        workspaceId,
                });

                return this.state;
        }

        async disconnect(): Promise<CloudConnectionStatus> {
                this.updateState({
                        connected: false,
                });

                return this.state;
        }

        async checkConnection(): Promise<boolean> {
                return this.state.connected;
        }

        private restore() {
                if (!this.storagePath) {
                        return;
                }

                try {
                        if (!fs.existsSync(this.storagePath)) {
                                return;
                        }

                        const content = fs.readFileSync(this.storagePath, 'utf-8');
                        const parsed = JSON.parse(content) as Partial<CloudConnectionStatus>;
                        this.state = {
                                connected: Boolean(parsed.connected),
                                workspaceId: parsed.workspaceId ?? null,
                                updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
                        };
                } catch (error) {
                        console.warn('Unable to restore Nicesoft cloud state, starting fresh', error);
                }
        }

        private updateState(update: Partial<CloudConnectionStatus>) {
                this.state = {
                        ...this.state,
                        ...update,
                        updatedAt: new Date().toISOString(),
                };

                this.persist();
        }

        private persist() {
                if (!this.storagePath) {
                        return;
                }

                try {
                        const directory = path.dirname(this.storagePath);
                        fs.mkdirSync(directory, { recursive: true });
                        fs.writeFileSync(this.storagePath, JSON.stringify(this.state, null, 2));
                } catch (error) {
                        console.warn('Unable to persist Nicesoft cloud state', error);
                }
        }
}

export const createCloudClient = (storagePath?: string): CloudController => new NicesoftCloudController(storagePath);

export const Cloud = createCloudClient();
