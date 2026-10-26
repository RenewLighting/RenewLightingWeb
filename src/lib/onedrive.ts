import type { Quote } from "@/lib/quote";
import { createQuoteWorkbook } from "@/lib/quote-workbook";

type GraphFolder = {
  id: string;
  name: string;
  webUrl?: string;
  folder?: { childCount?: number };
  parentReference?: { id?: string; driveId?: string };
};

type GraphFolderPage = {
  value?: GraphFolder[];
  "@odata.nextLink"?: string;
};

type GraphItem = GraphFolder & {
  webUrl?: string;
};

let cachedAccessToken = "";
let tokenExpiresAt = 0;
let tokenRequest: Promise<string> | null = null;

function getOneDriveConfig() {
  const tenantId = process.env.ONEDRIVE_TENANT_ID;
  const clientId = process.env.ONEDRIVE_CLIENT_ID;
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
  const driveId = process.env.ONEDRIVE_DRIVE_ID;
  const rootFolderId = process.env.ONEDRIVE_ROOT_FOLDER_ID;
  if (!tenantId || !clientId || !clientSecret || !driveId || !rootFolderId) {
    throw new Error("OneDrive is not configured. Ask an administrator to configure the shared quote library.");
  }
  return { tenantId, clientId, clientSecret, driveId, rootFolderId };
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) return cachedAccessToken;
  if (tokenRequest) return tokenRequest;
  const { tenantId, clientId, clientSecret } = getOneDriveConfig();
  tokenRequest = (async () => {
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.access_token !== "string") {
      console.error("Microsoft Graph token request failed:", body.error || response.status);
      throw new Error("Could not connect to the shared OneDrive library. Check the Microsoft app registration and permissions.");
    }
    cachedAccessToken = body.access_token;
    tokenExpiresAt = Date.now() + (Number(body.expires_in) || 3600) * 1000;
    return cachedAccessToken;
  })();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function graphRequest<T>(url: string, options: RequestInit = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const graphMessage = typeof body?.error?.message === "string" ? body.error.message : "";
    console.error("Microsoft Graph request failed:", response.status, graphMessage);
    throw new Error(response.status === 403
      ? "Microsoft Graph does not have permission to access this shared quote folder."
      : "The shared OneDrive request failed.");
  }
  return response.json() as Promise<T>;
}

function itemUrl(driveId: string, itemId: string) {
  return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
}

async function getFolderMetadata(driveId: string, itemId: string) {
  return graphRequest<GraphFolder>(
    `${itemUrl(driveId, itemId)}?$select=id,name,folder,parentReference,webUrl`,
  );
}

async function assertFolderIsWithinRoot(folderId: string) {
  const { driveId, rootFolderId } = getOneDriveConfig();
  let itemId = folderId;
  for (let depth = 0; depth < 30; depth += 1) {
    if (itemId === rootFolderId) return;
    const item = await getFolderMetadata(driveId, itemId);
    if (!item.folder) throw new Error("Choose a folder in the configured quote library.");
    if (item.parentReference?.driveId && item.parentReference.driveId !== driveId) {
      throw new Error("The selected folder is outside the configured quote library.");
    }
    const parentId = item.parentReference?.id;
    if (!parentId) break;
    itemId = parentId;
  }
  throw new Error("The selected folder is outside the configured quote library.");
}

export async function listQuoteFolders(parentId?: string) {
  const { driveId, rootFolderId } = getOneDriveConfig();
  const currentId = parentId || rootFolderId;
  await assertFolderIsWithinRoot(currentId);
  const current = await getFolderMetadata(driveId, currentId);
  if (!current.folder) throw new Error("The selected OneDrive location is not a folder.");

  const folders: Array<Pick<GraphFolder, "id" | "name" | "webUrl">> = [];
  let nextUrl: string | undefined = `${itemUrl(driveId, currentId)}/children?$select=id,name,folder,webUrl&$top=200`;
  while (nextUrl) {
    const page: GraphFolderPage = await graphRequest<GraphFolderPage>(nextUrl);
    folders.push(...(page.value || [])
      .filter((item) => item.folder && item.id && item.name)
      .map(({ id, name, webUrl }) => ({ id, name, webUrl })));
    nextUrl = page["@odata.nextLink"];
  }
  return {
    current: { id: current.id, name: current.name, webUrl: current.webUrl },
    folders: folders.sort((first, second) => first.name.localeCompare(second.name)),
  };
}

export async function saveQuoteWorkbookToOneDrive(quote: Quote, folderId: string, fileName: string) {
  const { driveId } = getOneDriveConfig();
  await assertFolderIsWithinRoot(folderId);
  const buffer = createQuoteWorkbook(quote);
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 180) || "quote.xlsx";
  const url = `${itemUrl(driveId, folderId)}:/${encodeURIComponent(safeName)}:/content?@microsoft.graph.conflictBehavior=rename`;
  const result = await graphRequest<GraphItem>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    body: new Uint8Array(buffer),
  });
  return { name: result.name, webUrl: result.webUrl };
}
