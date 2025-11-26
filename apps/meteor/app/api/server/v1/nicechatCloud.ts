import { Cloud } from '@rocket.chat/nicesoft-cloud';

import { API } from '../api';

const routeOptions = {
authRequired: true,
permissionsRequired: ['manage-cloud'],
};

API.v1.addRoute('nicechat-cloud.status', routeOptions, {
async get() {
const status = await Cloud.status();

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.connect', routeOptions, {
async post() {
const workspaceId = this.bodyParams?.workspaceId;

if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
return API.v1.failure('invalid-workspace-id');
}

const status = await Cloud.connect(workspaceId.trim());

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.disconnect', routeOptions, {
async post() {
const status = await Cloud.disconnect();

return API.v1.success({ status });
},
});

API.v1.addRoute('nicechat-cloud.checkConnection', routeOptions, {
async get() {
const connected = await Cloud.checkConnection();

return API.v1.success({ connected });
},
});
