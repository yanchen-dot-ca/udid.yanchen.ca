# UDID checker — how it works

`udid.yanchen.ca` mirrors udid.tech:

1. The page's **Get My UDID** button downloads `profile.mobileconfig`,
   an Apple *Profile Service* profile: when the user installs it,
   iOS POSTs the device's UDID, product, iOS version and serial to
   the profile's callback URL, `https://udid.yanchen.ca/enroll`.
2. GitHub Pages (this repo) serves the page and the profile file,
   but it cannot receive POSTs, and it serves `.mobileconfig` as
   `application/octet-stream` — Safari only hands a download to the
   profile installer when the MIME type is
   `application/x-apple-aspen-config`. A small Cloudflare Worker
   (`worker.js` in this folder) covers exactly those two paths:
   it answers the enroll POST by 302-redirecting Safari to
   `https://udid.yanchen.ca/#udid=…`, and it serves the profile
   with the correct headers. The UDID travels in the URL fragment,
   which browsers never send to a server; nothing is stored.
3. The user removes the temporary profile afterwards
   (Settings → General → VPN & Device Management).

## One-time setup

Do these in order:

1. **Let GitHub Pages issue the HTTPS certificate.** After the
   first push of this repo (which includes the `CNAME` file), wait
   until https://udid.yanchen.ca loads without a certificate error
   (usually minutes, can take up to an hour).
2. **Create the Worker.** Cloudflare dashboard → Workers & Pages →
   Create → Worker. Name it `udid`, deploy the placeholder, then
   Edit code, replace everything with `worker.js` from this folder,
   Deploy.
3. **Attach two routes** (worker → Settings → Triggers → Routes →
   Add route, zone `yanchen.ca`):
   - `udid.yanchen.ca/enroll`
   - `udid.yanchen.ca/profile.mobileconfig`
4. **Proxy the DNS record.** In Cloudflare DNS, edit the
   `udid` CNAME (→ `yanchenca.github.io`) and switch it from
   *DNS only* to *Proxied*. Worker routes only run on proxied
   records. If the site misbehaves right after the flip, set
   SSL/TLS → Encryption mode to **Full** (use Flexible only until
   the GitHub Pages certificate from step 1 exists).
5. On an iPhone, open https://udid.yanchen.ca in Safari and run
   through the flow once to verify.

## The profile must be SIGNED

Current iOS refuses to install an *unsigned* Profile Service
profile — installation fails with "Invalid Profile" (learned the
hard way, 2026-11-18). The profile is therefore CMS/PKCS#7-signed
with the Let's Encrypt certificate for `udid.yanchen.ca`:

- Source XML: `profile-unsigned.mobileconfig` in this folder.
  Its top-level `PayloadType` must be `Profile Service` (not
  `Configuration`) and the identifier is
  `ca.yanchen.udid.profile-service`.
- Signing: `sh sign.sh` (openssl smime, DER, with the cert chain).
  It refreshes `profile-signed.mobileconfig`, the repo-root
  `profile.mobileconfig`, and the base64 copy embedded in
  `worker.js` (`PROFILE_DER_B64`) in one go. All three must stay
  in sync — the Worker copy is what visitors actually get.
- The certificate was issued with certbot in manual DNS-01 mode
  (`certbot certonly --manual --preferred-challenges dns
  -d udid.yanchen.ca`), adding the `_acme-challenge.udid` TXT
  record in the Cloudflare dashboard. It is NOT auto-renewed.
  **The cert expires 2027-02-17**; before then, repeat the
  certbot command, run `sign.sh`, redeploy the Worker, and push.
  The cert/key backup lives outside this (public) repo in
  `~/workspace/udid-certs/` on Sky's VM — never commit a key here.
- During install iOS shows the signer as the certificate holder
  (Let's Encrypt chain); there is no "Not Verified" warning.
