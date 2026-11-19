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
// Everything else falls through to GitHub Pages. The Worker itself
// stores and logs nothing; it answers the enroll POST with a 301
// to the result page carrying the values in the query string
// (the form the device's profile installer accepts).
//
// The profile below is the CMS/PKCS#7-signed form of
// profile-unsigned.mobileconfig (in this folder), signed with the
// Let's Encrypt certificate for udid.yanchen.ca. Current iOS
// refuses to install an UNSIGNED Profile Service profile
// ("Invalid Profile"), so the signed bytes are what must be
// served. When the certificate is renewed, re-sign and replace
// PROFILE_DER_B64 — see README.md in this folder.
//
// Deploy: see README.md in this folder.

// Base64 of the signed profile (DER). One long line, replaced by
// sign.sh at signing time.
const PROFILE_DER_B64 = "MIITYgYJKoZIhvcNAQcCoIITUzCCE08CAQExDzANBglghkgBZQMEAgEFADCCBE0GCSqGSIb3DQEHAaCCBD4EggQ6PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4NCjwhRE9DVFlQRSBwbGlzdCBQVUJMSUMgIi0vL0FwcGxlLy9EVEQgUExJU1QgMS4wLy9FTiIgImh0dHA6Ly93d3cuYXBwbGUuY29tL0RURHMvUHJvcGVydHlMaXN0LTEuMC5kdGQiPg0KPHBsaXN0IHZlcnNpb249IjEuMCI+DQo8ZGljdD4NCgk8a2V5PlBheWxvYWRDb250ZW50PC9rZXk+DQoJPGRpY3Q+DQoJCTxrZXk+VVJMPC9rZXk+DQoJCTxzdHJpbmc+aHR0cHM6Ly91ZGlkLnlhbmNoZW4uY2EvZW5yb2xsPC9zdHJpbmc+DQoJCTxrZXk+RGV2aWNlQXR0cmlidXRlczwva2V5Pg0KCQk8YXJyYXk+DQoJCQk8c3RyaW5nPlVESUQ8L3N0cmluZz4NCgkJCTxzdHJpbmc+UFJPRFVDVDwvc3RyaW5nPg0KCQkJPHN0cmluZz5WRVJTSU9OPC9zdHJpbmc+DQoJCQk8c3RyaW5nPlNFUklBTDwvc3RyaW5nPg0KCQk8L2FycmF5Pg0KCTwvZGljdD4NCgk8a2V5PlBheWxvYWREZXNjcmlwdGlvbjwva2V5Pg0KCTxzdHJpbmc+VGVtcG9yYXJ5IHByb2ZpbGUgdGhhdCBsZXRzIHVkaWQueWFuY2hlbi5jYSByZWFkIHRoaXMgZGV2aWNlJ3MgVURJRC4gUmVtb3ZlIGl0IGFmdGVyIHVzZTogU2V0dGluZ3MsIEdlbmVyYWwsIFZQTiAmYW1wOyBEZXZpY2UgTWFuYWdlbWVudC48L3N0cmluZz4NCgk8a2V5PlBheWxvYWREaXNwbGF5TmFtZTwva2V5Pg0KCTxzdHJpbmc+dWRpZC55YW5jaGVuLmNhIOKAlCBHZXQgVURJRDwvc3RyaW5nPg0KCTxrZXk+UGF5bG9hZElkZW50aWZpZXI8L2tleT4NCgk8c3RyaW5nPmNhLnlhbmNoZW4udWRpZC5wcm9maWxlLXNlcnZpY2U8L3N0cmluZz4NCgk8a2V5PlBheWxvYWRPcmdhbml6YXRpb248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";

function profileBytes() {
  const bin = atob(PROFILE_DER_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const RESULT_PAGE = "https://udid.yanchen.ca/";

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
      // Match the reference implementations (udid.tech and the
      // open-source UDID servers): a 301 to a result URL carrying
      // the values in the QUERY STRING. The device's profile
      // installer follows this redirect itself during install;
      // a 302 to a #fragment URL made installation fail with
      // "Invalid Profile" on iOS 27.
      return new Response(null, {
        status: 301,
        headers: { location: RESULT_PAGE + "?" + params.toString() },
      });
    }

    // GitHub Pages serves the profile as application/octet-stream,
    // but the aspen-config MIME type is what tells Safari to hand
    // the download to the profile installer.
    if (request.method === "GET" && url.pathname === "/profile.mobileconfig") {
      return new Response(profileBytes(), {
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
