import { ServiceClassInternal } from '@rocket.chat/core-services';
import type { IOmnichannelService } from '@rocket.chat/core-services';
import type { AtLeast, IOmnichannelQueue, IOmnichannelRoom } from '@rocket.chat/core-typings';
import { LivechatContacts } from '@rocket.chat/models';
import moment from 'moment';

import { OmnichannelQueue } from './queue';
import { RoutingManager } from '../../../app/livechat/server/lib/RoutingManager';
import { notifyAgentStatusChanged } from '../../../app/livechat/server/lib/omni-users';
import { settings } from '../../../app/settings/server';
import {
        onLimitReached,
        onLimitRestored,
        onLicenseChanged,
        registerLimitCounter,
        shouldPreventAction,
} from '../../lib/nicesoft-license';

const MONTHLY_ACTIVE_CONTACTS_LIMIT = 'monthlyActiveContacts';

registerLimitCounter(MONTHLY_ACTIVE_CONTACTS_LIMIT, () =>
        LivechatContacts.countContactsOnPeriod(moment.utc().format('YYYY-MM')),
);

export class OmnichannelService extends ServiceClassInternal implements IOmnichannelService {
	protected name = 'omnichannel';

	private queueWorker: IOmnichannelQueue;

	constructor() {
		super();
		this.queueWorker = new OmnichannelQueue();
	}

	async created() {
		this.onEvent('presence.status', async ({ user }): Promise<void> => {
			if (!user?._id) {
				return;
			}
			const hasRole = user.roles.some((role) => ['livechat-manager', 'livechat-monitor', 'livechat-agent'].includes(role));
			if (hasRole) {
				// TODO change `Livechat.notifyAgentStatusChanged` to a service call
				await notifyAgentStatusChanged(user._id, user.status);
			}
		});
	}

        async started() {
                settings.watchMultiple(['Livechat_enabled', 'Livechat_Routing_Method'], () => {
                        this.queueWorker.shouldStart();
                });

                onLimitReached(async (limit) => {
                        if (limit !== MONTHLY_ACTIVE_CONTACTS_LIMIT) {
                                return;
                        }

                        if (this.queueWorker.isRunning()) {
                                await this.queueWorker.stop();
                        }
                });

                const restartQueue = async (): Promise<void> => {
                        if (RoutingManager.isMethodSet()) {
                                await this.queueWorker.shouldStart();
                        }
                };
	}

                onLimitRestored(async (limit) => {
                        if (limit !== MONTHLY_ACTIVE_CONTACTS_LIMIT) {
                                return;
                        }

                        await restartQueue();
                });

                onLicenseChanged(async () => {
                        await restartQueue();
                });
        }

        async isWithinMACLimit(room: AtLeast<IOmnichannelRoom, 'v'>): Promise<boolean> {
                const currentMonth = moment.utc().format('YYYY-MM');
                return (
                        room.v?.activity?.includes(currentMonth) ||
                        !(await shouldPreventAction(MONTHLY_ACTIVE_CONTACTS_LIMIT))
                );
        }
}
