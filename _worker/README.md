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

## Notes

- The profile is unsigned, so iOS labels it "Not Verified" during
  install. That is normal for this kind of tool; signing would need
  a certificate whose private key we control for this purpose.
- `profile.mobileconfig` in this repo and the copy embedded in
  `worker.js` must stay identical — the repo file is the fallback
  download, the Worker copy is what most visitors actually get.
