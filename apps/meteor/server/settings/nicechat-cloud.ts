import { settingsRegistry } from '../../app/settings/server';

export const createNicechatCloudSettings = () =>
        settingsRegistry.addGroup('NiceChat', async function () {
                await this.section('Nicechat_Cloud', async function () {
                        await this.add('Nicechat_Cloud_Enabled', false, {
                                type: 'boolean',
                                public: false,
                        });

                        await this.add('Nicechat_Cloud_Workspace_Id', '', {
                                type: 'string',
                                public: false,
                        });

                        await this.add('Nicechat_Cloud_Connected', false, {
                                type: 'boolean',
                                public: false,
                        });

                        await this.add('Nicechat_Cloud_Updated_At', new Date(0).toISOString(), {
                                type: 'string',
                                public: false,
                        });
                });
        });
