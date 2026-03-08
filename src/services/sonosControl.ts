const RENDERING_CONTROL = "urn:schemas-upnp-org:service:RenderingControl:1";
const AV_TRANSPORT = "urn:schemas-upnp-org:service:AVTransport:1";

function soapEnvelope(serviceType: string, action: string, body: string): string {
  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${serviceType}"><InstanceID>0</InstanceID>${body}</u:${action}></s:Body></s:Envelope>`;
}

async function sendCommand(
  ip: string,
  endpoint: string,
  serviceType: string,
  action: string,
  body: string,
): Promise<void> {
  await fetch(`http://${ip}:1400${endpoint}`, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPACTION: `"${serviceType}#${action}"`,
    },
    body: soapEnvelope(serviceType, action, body),
  });
}

export async function setMute(ip: string, mute: boolean): Promise<void> {
  await sendCommand(
    ip,
    "/MediaRenderer/RenderingControl/Control",
    RENDERING_CONTROL,
    "SetMute",
    `<Channel>Master</Channel><DesiredMute>${mute ? 1 : 0}</DesiredMute>`,
  );
}

export async function setVolume(ip: string, volume: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  await sendCommand(
    ip,
    "/MediaRenderer/RenderingControl/Control",
    RENDERING_CONTROL,
    "SetVolume",
    `<Channel>Master</Channel><DesiredVolume>${clamped}</DesiredVolume>`,
  );
}

export async function play(ip: string): Promise<void> {
  await sendCommand(
    ip,
    "/MediaRenderer/AVTransport/Control",
    AV_TRANSPORT,
    "Play",
    "<Speed>1</Speed>",
  );
}

export async function pause(ip: string): Promise<void> {
  await sendCommand(
    ip,
    "/MediaRenderer/AVTransport/Control",
    AV_TRANSPORT,
    "Pause",
    "",
  );
}

export async function setAVTransportURI(ip: string, uri: string, metadata = ""): Promise<void> {
  const escapedUri = uri.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedMeta = metadata.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await sendCommand(
    ip,
    "/MediaRenderer/AVTransport/Control",
    AV_TRANSPORT,
    "SetAVTransportURI",
    `<CurrentURI>${escapedUri}</CurrentURI><CurrentURIMetaData>${escapedMeta}</CurrentURIMetaData>`,
  );
}

export interface LocalCommand {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export async function executeLocalCommand(cmd: LocalCommand): Promise<void> {
  await fetch(cmd.url, {
    method: "POST",
    mode: "no-cors",
    headers: cmd.headers,
    body: cmd.body,
  });
}
