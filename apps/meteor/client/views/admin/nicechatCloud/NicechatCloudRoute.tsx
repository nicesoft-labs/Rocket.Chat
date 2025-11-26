import { useRoutePath } from '@rocket.chat/ui-contexts';

import NicechatCloudPage from './NicechatCloudPage';
import { AdministrationLayout } from '../AdministrationLayout';

const NicechatCloudRoute = () => {
	const backToAdmin = useRoutePath('admin-index');

	return (
		<AdministrationLayout title='nicechat-cloud' backToAdmin={backToAdmin}>
			<NicechatCloudPage />
		</AdministrationLayout>
	);
};

export default NicechatCloudRoute;
