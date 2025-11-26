import { Settings } from '@rocket.chat/models';

export async function ensureCloudWorkspaceRegistered(): Promise<void> {
	const cloudWorkspaceClientId = await Settings.getValueById('Cloud_Workspace_Client_Id');
	const cloudWorkspaceClientSecret = await Settings.getValueById('Cloud_Workspace_Client_Secret');

	// No-op when registration is missing to avoid blocking startup flows.
	if (!cloudWorkspaceClientId || !cloudWorkspaceClientSecret) {
		return;
	}
}
