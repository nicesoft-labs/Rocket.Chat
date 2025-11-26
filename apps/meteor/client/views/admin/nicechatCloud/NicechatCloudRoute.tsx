import { usePermission, useRoutePath } from '@rocket.chat/ui-contexts';

import NicechatCloudPage from './NicechatCloudPage';
import { AdministrationLayout } from '../AdministrationLayout';
import NotAuthorizedPage from '../../notAuthorized/NotAuthorizedPage';

const NicechatCloudRoute = () => {
        const backToAdmin = useRoutePath('admin-index');
        const canAccessNicechatCloud = usePermission('view-nicechat-cloud');

        if (!canAccessNicechatCloud) {
                return <NotAuthorizedPage />;
        }

        return (
                <AdministrationLayout title='nicechat-cloud' backToAdmin={backToAdmin}>
                        <NicechatCloudPage />
                </AdministrationLayout>
        );
};

export default NicechatCloudRoute;
