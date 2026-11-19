// UDID callback + profile server for https://udid.yanchen.ca
//
// GitHub Pages hosts the static site but cannot receive the POST a
// device sends when the profile is installed, and it serves
// .mobileconfig with the wrong MIME type. This Worker covers just
// those two paths via Cloudflare routes (the DNS record must be
// Proxied for routes to run):
//
//   udid.yanchen.ca/enroll              -> POST from the device
//   udid.yanchen.ca/profile.mobileconfig -> profile download
//
// Everything else falls through to GitHub Pages. Nothing is stored
// or logged; the UDID returns to the page in the URL fragment
// (after #), which browsers never send to a server.
//
// Deploy: see README.md in this folder.

const RESULT_PAGE = "https://udid.yanchen.ca/";

// Must match profile.mobileconfig in this repo.
const PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<dict>
		<key>URL</key>
		<string>https://udid.yanchen.ca/enroll</string>
		<key>DeviceAttributes</key>
		<array>
			<string>UDID</string>
			<string>PRODUCT</string>
			<string>VERSION</string>
			<string>SERIAL</string>
		</array>
	</dict>
	<key>PayloadDescription</key>
	<string>Temporary profile that lets udid.yanchen.ca read this device's UDID. Remove it after use: Settings, General, VPN &amp; Device Management.</string>
	<key>PayloadDisplayName</key>
	<string>udid.yanchen.ca — Get UDID</string>
	<key>PayloadIdentifier</key>
	<string>ca.yanchen.udid.profile-service</string>
	<key>PayloadOrganization</key>
	<string>yanchen.ca</string>
	<key>PayloadType</key>
	<string>Profile Service</string>
	<key>PayloadUUID</key>
	<string>1A255C46-2B0F-458C-9227-9A8A4C00CE41</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`;

function pick(body, key) {
  const m = body.match(
    new RegExp("<key>" + key + "</key>\\s*<string>([^<]*)</string>")
  );
  return m ? m[1].trim() : "";
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/enroll") {
      const body = await request.text();
      const udid = pick(body, "UDID");
      if (!udid) {
        return new Response("No UDID in request", { status: 400 });
      }
      const params = new URLSearchParams();
      params.set("udid", udid);
      for (const key of ["PRODUCT", "VERSION", "SERIAL"]) {
        const value = pick(body, key);
        if (value) params.set(key.toLowerCase(), value);
      }
      return Response.redirect(RESULT_PAGE + "#" + params.toString(), 302);
    }

    // GitHub Pages serves the profile as application/octet-stream,
    // but the aspen-config MIME type is what tells Safari to hand
    // the download to the profile installer.
    if (request.method === "GET" && url.pathname === "/profile.mobileconfig") {
      return new Response(PROFILE, {
        headers: {
          "content-type": "application/x-apple-aspen-config",
          "content-disposition": "attachment; filename=profile.mobileconfig",
          "cache-control": "no-store",
        },
      });
    }

    // Not reached when only the two routes above are attached, but
    // keeps the Worker safe if it is ever bound to the whole host.
    return fetch(request);
  },
};
