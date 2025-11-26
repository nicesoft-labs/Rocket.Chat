import type { CloudConnectionStatus, CloudController } from '@rocket.chat/nicesoft-cloud';
import { Settings } from '@rocket.chat/models';

import { notifyOnSettingChangedById } from '../../lib/server/lib/notifyListener';
import { settings } from '../../settings/server';

const enabledSettingId = 'Nicechat_Cloud_Enabled';
const workspaceIdSettingId = 'Nicechat_Cloud_Workspace_Id';
const connectedSettingId = 'Nicechat_Cloud_Connected';
const updatedAtSettingId = 'Nicechat_Cloud_Updated_At';

const getStatusFromSettings = (): CloudConnectionStatus => ({
        connected: Boolean(settings.get<boolean>(enabledSettingId) && settings.get<boolean>(connectedSettingId)),
        workspaceId: settings.get<string>(workspaceIdSettingId) || null,
        updatedAt: settings.get<string>(updatedAtSettingId) || new Date(0).toISOString(),
});

const updateSetting = async <T>(id: string, value: T) => {
        const result = await Settings.updateValueById(id, value);

        if (result?.modifiedCount) {
                void notifyOnSettingChangedById(id);
        }
};

class NicechatCloudSettingsController implements CloudController {
        async status(): Promise<CloudConnectionStatus> {
                return getStatusFromSettings();
        }

        async connect(workspaceId: string): Promise<CloudConnectionStatus> {
                if (!workspaceId || typeof workspaceId !== 'string') {
                        throw new Error('workspaceId must be a non-empty string');
                }

                const updatedAt = new Date().toISOString();

                await Promise.all([
                        updateSetting(enabledSettingId, true),
                        updateSetting(workspaceIdSettingId, workspaceId),
                        updateSetting(connectedSettingId, true),
                        updateSetting(updatedAtSettingId, updatedAt),
                ]);

                return {
                        connected: true,
                        workspaceId,
                        updatedAt,
                };
        }

        async disconnect(): Promise<CloudConnectionStatus> {
                const updatedAt = new Date().toISOString();
                const { workspaceId } = getStatusFromSettings();

                await Promise.all([
                        updateSetting(enabledSettingId, false),
                        updateSetting(connectedSettingId, false),
                        updateSetting(updatedAtSettingId, updatedAt),
                ]);

                return {
                        connected: false,
                        workspaceId,
                        updatedAt,
                };
        }

        async checkConnection(): Promise<boolean> {
                const { connected } = getStatusFromSettings();

                return connected;
        }
}

export const NicechatCloud: CloudController = new NicechatCloudSettingsController();
