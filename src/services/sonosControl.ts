import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { LocalCommand } from "./vibeApi";

const RENDERING_CONTROL = "urn:schemas-upnp-org:service:RenderingControl:1";
const AV_TRANSPORT = "urn:schemas-upnp-org:service:AVTransport:1";

function soapEnvelope(serviceType: string, action: string, body: string): string {
  return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${serviceType}"><InstanceID>0</InstanceID>${body}</u:${action}></s:Body></s:Envelope>`;
}

// Native-aware HTTP POST for Sonos UPnP/SOAP.
// On Android: CapacitorHttp uses the OS network stack — bypasses CORS + WebView cleartext sandbox.
// On web/dev: falls back to standard fetch.
async function sonosPost(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await CapacitorHttp.request({
      method: "POST",
      url,
      headers,
      data: body,
      responseType: "text",
    });
  } else {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers,
      body,
    });
  }
}

async function sendCommand(
  ip: string,
  endpoint: string,
  serviceType: string,
  action: string,
  body: string,
): Promise<void> {
  await sonosPost(
    `http://${ip}:1400${endpoint}`,
    {
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPACTION: `"${serviceType}#${action}"`,
    },
    soapEnvelope(serviceType, action, body),
  );
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

export async function executeLocalCommand(cmd: LocalCommand): Promise<void> {
  await sonosPost(
    cmd.url,
    {
      ...cmd.headers,
      "Content-Type": 'text/xml; charset="utf-8"',
    },
    cmd.body,
  );
}

export type { LocalCommand };
