import { NicechatCloud } from '../../../nicechat-cloud/server/controller';

import { API } from '../api';

const routeOptions = {
        authRequired: true,
        permissionsRequired: ['view-nicechat-cloud'],
};

API.v1.addRoute('nicechat-cloud.status', routeOptions, {
async get() {
                const status = await NicechatCloud.status();

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.connect', routeOptions, {
async post() {
const workspaceId = this.bodyParams?.workspaceId;

if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
return API.v1.failure('invalid-workspace-id');
}

                const status = await NicechatCloud.connect(workspaceId.trim());

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.disconnect', routeOptions, {
async post() {
                const status = await NicechatCloud.disconnect();

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.checkConnection', routeOptions, {
async get() {
                const connected = await NicechatCloud.checkConnection();

return API.v1.success({ connected });
},
});
