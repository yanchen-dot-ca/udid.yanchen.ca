#!/bin/sh
# Re-sign the UDID profile after a certificate renewal and refresh
# the Worker's embedded copy. Run on the VM where certbot issued
# the cert (Let's Encrypt, DNS-01, manual).
#   sh sign.sh
set -e
LIVE=/etc/letsencrypt/live/udid.yanchen.ca
DIR=$(dirname "$0")
openssl smime -sign -in "$DIR/profile-unsigned.mobileconfig" \
  -out "$DIR/profile-signed.mobileconfig" \
  -signer "$LIVE/cert.pem" -inkey "$LIVE/privkey.pem" \
  -certfile "$LIVE/chain.pem" -outform DER -nodetach
# Also refresh the copy GitHub Pages would serve as a fallback.
cp "$DIR/profile-signed.mobileconfig" "$DIR/../profile.mobileconfig"
B64=$(base64 -w0 "$DIR/profile-signed.mobileconfig")
python3 - "$DIR/worker.js" "$B64" <<'PY'
import re, sys
path, b64 = sys.argv[1], sys.argv[2]
src = open(path).read()
src = re.sub(r'const PROFILE_DER_B64 = "[^"]*";',
             'const PROFILE_DER_B64 = "%s";' % b64, src, count=1)
open(path, "w").write(src)
print("worker.js updated, base64 length:", len(b64))
PY
openssl smime -verify -inform DER -in "$DIR/profile-signed.mobileconfig" \
  -noverify -out /dev/null
echo "signature OK"
